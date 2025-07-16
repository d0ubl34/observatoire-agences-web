<?php
/**
 * Plugin Name: Observatoire Agences Web
 * Description: Affiche le classement des agences web basé sur les audits Lighthouse.
 * Version: 1.0
 * Author: Cascade AI
 */

// Flag pour savoir si le shortcode est utilisé
function oaw_shortcode() {

    // 1. Charger les assets directement depuis le shortcode. C'est la méthode la plus robuste.
    // WordPress est assez intelligent pour ne pas les charger plusieurs fois si le shortcode est présent plusieurs fois.

    // Charger le style CSS
    wp_enqueue_style('oaw-style', plugin_dir_url(__FILE__) . 'style.css');

    // Charger le script JS (avec une version dynamique pour éviter les problèmes de cache)
    $script_path = plugin_dir_path(__FILE__) . 'script.js';
    $script_version = file_exists($script_path) ? filemtime($script_path) : '1.0';
    wp_enqueue_script('observatoire-agences-web-script', plugin_dir_url(__FILE__) . 'script.js', array('jquery'), $script_version, true);

    // Passer les données nécessaires au script (URL AJAX, nonces, etc.)
    wp_localize_script('observatoire-agences-web-script', 'oaw_data', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'get_data_nonce' => wp_create_nonce('oaw_get_data_nonce'),
        'refresh_nonce' => wp_create_nonce('oaw_refresh_nonce'),
        'plugin_url' => plugin_dir_url(__FILE__)
    ));

    // 2. Générer le HTML du tableau
    ob_start();
    ?>
    <div class="oaw-container">
        <table id="agenciesTable">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Agence</th>
                    <th>URL</th>
                    <th class="sortable" data-sort="performance">Perf<span class="sort-indicator"></span></th>
                    <th class="sortable" data-sort="accessibility">Acc<span class="sort-indicator"></span></th>
                    <th class="sortable" data-sort="best-practices">BP<span class="sort-indicator"></span></th>
                    <th class="sortable" data-sort="seo">SEO<span class="sort-indicator"></span></th>
                    <th class="sortable" data-sort="carbon">EC<span class="sort-indicator"></span></th>
                    <th>Rapport</th>
                    <th>Date audit</th>
                </tr>
            </thead>
            <tbody>
                <!-- Les données seront insérées ici par JavaScript -->
            </tbody>
        </table>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('observatoire_agences_web', 'oaw_shortcode');

// Add a function to serve the JSON data via AJAX
function oaw_get_lighthouse_data() {
    check_ajax_referer('oaw_get_data_nonce', 'nonce');

    $file_path = plugin_dir_path(__FILE__) . 'lighthouse-results.json';
    if (file_exists($file_path)) {
        wp_send_json_success(json_decode(file_get_contents($file_path)));
    } else {
        wp_send_json_success([]);
    }
    wp_die();
}
add_action('wp_ajax_oaw_get_lighthouse_data', 'oaw_get_lighthouse_data');
add_action('wp_ajax_nopriv_oaw_get_lighthouse_data', 'oaw_get_lighthouse_data');

// AJAX handler for refreshing Lighthouse data
function oaw_refresh_lighthouse_data() {
    // Check for nonce for security
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'oaw_refresh_nonce')) {
        wp_send_json_error('Security check failed');
    }

    // Get agency URL from AJAX request
    $agency_url = isset($_POST['agency_url']) ? sanitize_url($_POST['agency_url']) : '';

    // Rate Limiting: 1 refresh per hour per IP per agency
    $ip = $_SERVER['REMOTE_ADDR'];
    $transient_key = 'oaw_refresh_' . md5($ip . '_' . $agency_url);
    if (get_transient($transient_key)) {
        wp_send_json_error('Vous avez déjà mis à jour ces données ! 😅 Merci de revenir dans une heure.');
    }


    if (empty($agency_url)) {
        wp_send_json_error('Agency URL is missing');
    }

    // Get API key from wp-config.php constant
    if (!defined('OAW_GOOGLE_API_KEY')) {
        wp_send_json_error('Google API Key constant is not defined in wp-config.php.');
    }
    $api_key = defined('OAW_GOOGLE_API_KEY') ? OAW_GOOGLE_API_KEY : '';

    if (empty($api_key)) {
        wp_send_json_error(['message' => 'La clé API Google n\'est pas configurée.']);
        return;
    }

    $api_url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' . urlencode($agency_url) . '&key=' . $api_key . '&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&strategy=mobile'; // Use 'category' parameter multiple times for each category and set strategy to mobile

    $response = wp_remote_get($api_url, array('timeout' => 120)); // Increase timeout to 60 seconds

    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);

    if (!isset($data['lighthouseResult']['categories'])) {
        wp_send_json_error('Invalid response from PageSpeed Insights API.');
    }

    $scores = [
        'performance' => $data['lighthouseResult']['categories']['performance']['score'] * 100,
        'accessibility' => $data['lighthouseResult']['categories']['accessibility']['score'] * 100,
        'best-practices' => $data['lighthouseResult']['categories']['best-practices']['score'] * 100,
        'seo' => $data['lighthouseResult']['categories']['seo']['score'] * 100,
        // Carbon score is not directly available via PSI API, keep existing or handle separately
        'carbon' => null, // Placeholder for now
        'carbonCleanerThan' => null, // Placeholder for now
        'psiReportUrl' => 'https://pagespeed.web.dev/report?url=' . urlencode($agency_url),
        'faviconUrl' => 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=' . urlencode($agency_url) . '&size=64' // Re-add favicon URL logic
    ];

    // Extract total byte weight from PageSpeed Insights data
    $total_bytes = isset($data['lighthouseResult']['audits']['total-byte-weight']['numericValue']) ? $data['lighthouseResult']['audits']['total-byte-weight']['numericValue'] : 0;

    // Call Website Carbon API using the /data endpoint
    if ($total_bytes > 0) {
        // We assume hosting is not green (0) as we don't have that information
        $carbon_api_url = 'https://api.websitecarbon.com/data?bytes=' . $total_bytes . '&green=0';
        $carbon_response = wp_remote_get($carbon_api_url, array('timeout' => 180));

        if (!is_wp_error($carbon_response)) {
            $carbon_body = wp_remote_retrieve_body($carbon_response);
            $carbon_data = json_decode($carbon_body, true);

            error_log('Website Carbon API Raw Response: ' . $carbon_body);
            error_log('Website Carbon API Decoded Data: ' . print_r($carbon_data, true));

            // Use the new response structure from the /data endpoint
            if (isset($carbon_data['gco2e'])) {
                $scores['carbon'] = $carbon_data['gco2e'];
            }
            if (isset($carbon_data['cleanerThan'])) {
                $scores['carbonCleanerThan'] = $carbon_data['cleanerThan'] * 100;
            }
        }
    } else {
        error_log('Could not retrieve total byte weight from PageSpeed API for ' . $agency_url);
    }

    $json_file_path = plugin_dir_path(__FILE__) . 'lighthouse-results.json';
    $all_agencies_data = [];

    if (file_exists($json_file_path)) {
        $json_content = file_get_contents($json_file_path);
        $all_agencies_data = json_decode($json_content, true);
    }

    $updated = false;
    foreach ($all_agencies_data as &$agency) {
        if (isset($agency['url']) && $agency['url'] === $agency_url) {
            // Update existing audit or add new one
            $agency['latestAudit'] = [
                'date' => gmdate('Y-m-d\TH:i:s.000\Z'), // Current UTC date
                'scores' => $scores // Use the newly calculated scores including carbon
            ];
            $updated = true;
            break;
        }
    }

    if (!$updated) {
        // If agency not found, we might want to add it or send an error
        // For now, let's just send a success message without updating the JSON
        // TODO: Decide how to handle new agencies or agencies not in the JSON
        wp_send_json_error('Agency URL not found in data file. No update performed.');
    }

    // Write updated data back to the JSON file
    if (file_put_contents($json_file_path, json_encode($all_agencies_data, JSON_PRETTY_PRINT)) === false) {
        wp_send_json_error('Failed to write data to JSON file. Check file permissions.');
    }

    // Set the transient to block further requests for 1 hour
    set_transient($transient_key, 'blocked', HOUR_IN_SECONDS);

    wp_send_json_success(array('message' => 'Lighthouse data refreshed and updated for ' . $agency_url, 'scores' => $scores));
}

add_action('wp_ajax_oaw_refresh_lighthouse', 'oaw_refresh_lighthouse_data');
add_action('wp_ajax_nopriv_oaw_refresh_lighthouse', 'oaw_refresh_lighthouse_data');

