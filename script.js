document.addEventListener('DOMContentLoaded', function() {
    // Tableau pour stocker les URLs des agences en cours d'actualisation
    let refreshingAgencies = [];
    let allAgenciesData = []; // To store the original fetched data
    let currentSortColumn = 'compositeScore'; // Default sort column
    let currentSortOrder = 'desc'; // Default sort order (descending for composite score, as higher is better)

    async function loadResults() {
        try {
            const response = await fetch(oaw_data.ajax_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'action': 'oaw_get_lighthouse_data',
                    'nonce': oaw_data.get_data_nonce
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.data.message || 'Failed to fetch data via AJAX.');
            }

            allAgenciesData = result.data; // Store fetched data

            allAgenciesData.forEach(agency => {
                const latestAudit = agency.latestAudit;
                if (latestAudit && latestAudit.scores) {
                    agency.compositeScore = calculateCompositeScore(latestAudit.scores);
                } else {
                    agency.compositeScore = 0; // Default to 0 if no scores
                }
            });

            sortTable(currentSortColumn, currentSortOrder);


            // Add event listeners to table headers
            document.querySelectorAll('#agenciesTable th[data-sort]').forEach(header => {
                header.addEventListener('click', function() {
                    const column = this.dataset.sort;
                    if (column === currentSortColumn) {
                        if (column === 'carbon') {
                            if (currentSortOrder === 'asc') {
                                currentSortOrder = 'desc';
                            } else if (currentSortOrder === 'desc') {
                                // Third state: reset to default sort (compositeScore desc)
                                currentSortColumn = 'compositeScore';
                                currentSortOrder = 'desc';
                            }
                        } else { // For other score columns (Perf, Acc, BP, SEO, Classement)
                            if (currentSortOrder === 'desc') {
                                currentSortOrder = 'asc';
                            } else if (currentSortOrder === 'asc') {
                                // Third state: reset to default sort (compositeScore desc)
                                currentSortColumn = 'compositeScore';
                                currentSortOrder = 'desc';
                            }
                        }
                    } else {
                        currentSortColumn = column;
                        // Default sort order for new column
                        if (column === 'carbon') {
                            currentSortOrder = 'asc'; // Lower carbon is better
                        } else {
                            currentSortOrder = 'desc'; // Higher scores are better for others
                        }
                    }
                    sortTable(currentSortColumn, currentSortOrder);
                    updateSortIndicators();
                });
            });

            updateSortIndicators(); // Initial call to set indicators

        } catch (error) {
            console.error('Erreur lors du chargement des résultats:', error);
            document.getElementById('agenciesTable').getElementsByTagName('tbody')[0].innerHTML = '<tr><td colspan="9">Erreur lors du chargement des données.</td></tr>';
        }
    }

    function renderTable(agenciesToRender) {
        const tableBody = document.getElementById('agenciesTable').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = ''; // Clear existing rows

        agenciesToRender.forEach((agency, index) => {
            // Vérifie si l'agence est en cours d'actualisation
            const isRefreshing = refreshingAgencies.includes(agency.url);
            if (agency.latestAudit) {
                const latestAudit = agency.latestAudit;
                let row = '';
                row += '<tr class="' + (index < 3 ? 'top-rank' : '') + '">';
                row += '    <td class="rank-cell"><span>' + (index + 1) + '</span></td>';
                row += '    <td class="agency-cell"><img src="' + latestAudit.scores.faviconUrl + '" alt="Favicon de ' + agency.name + '" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 10px; margin-top: -2px;">' + agency.name + '</td>';
                row += '    <td class="url-cell"><a href="' + agency.url + '" target="_blank" rel="noopener noreferrer">' + agency.url + '</a></td>';
                row += '    <td class="performance-cell"><span class="score ' + getScoreClass(latestAudit.scores.performance) + '">' + Math.round(latestAudit.scores.performance) + '</span></td>';
                row += '    <td class="accessibility-cell"><span class="score ' + getScoreClass(latestAudit.scores.accessibility) + '">' + Math.round(latestAudit.scores.accessibility) + '</span></td>';
                row += '    <td class="best-practices-cell"><span class="score ' + getScoreClass(latestAudit.scores['best-practices']) + '">' + Math.round(latestAudit.scores['best-practices']) + '</span></td>';
                row += '    <td class="seo-cell"><span class="score ' + getScoreClass(latestAudit.scores.seo) + '">' + Math.round(latestAudit.scores.seo) + '</span></td>';
                row += '    <td class="carbon-cell">' + (latestAudit.scores.carbon !== null && latestAudit.scores.carbon !== undefined ? '<span class="score ' + getCarbonScoreClass(latestAudit.scores.carbon) + '">' + latestAudit.scores.carbon.toFixed(2) + '</span>' : 'N/A') + '</td>';
                row += '    <td class="actions-cell">';
                row += '        <a href="' + latestAudit.scores.psiReportUrl + '" target="_blank" rel="noopener noreferrer" class="psi-link" title="Voir le rapport PageSpeed Insights"><img src="' + oaw_data.plugin_url + 'img/tachometer-fast.svg" alt="Rapport PageSpeed" class="iconsvg"></a>';
                const carbonSlug = new URL(agency.url).hostname.replace(/^www\./, '').replace(/\./g, '-');
                row += '        <a href="https://www.websitecarbon.com/website/' + carbonSlug + '" target="_blank" rel="noopener noreferrer" class="carbon-link" title="Tester sur Website Carbon"><img src="' + oaw_data.plugin_url + 'img/carbon-cloud-arrow-down.svg" alt="Test Carbone" class="iconsvg"></a>';
                row += '        <button class="refresh-button' + (isRefreshing ? ' refreshing' : '') + '" data-url="' + agency.url + '" title="Actualiser les données"><img src="' + oaw_data.plugin_url + 'img/refresh.svg" alt="Actualiser" class="iconsvg refresh-icon' + (isRefreshing ? ' rotating' : '') + '"></button>';
                row += '    </td>';
                row += '    <td class="audit-date-cell">' + new Date(latestAudit.date).toLocaleString() + '</td>';
                row += '</tr>';

                tableBody.innerHTML += row;
            }
        });

        attachRefreshButtonListeners(); // Attach listeners after rendering

    } // End of renderTable function

    function attachRefreshButtonListeners() {
        document.querySelectorAll('.refresh-button').forEach(button => {
            button.addEventListener('click', async function() {
                const $button = this; // Référence au bouton
                const $icon = $button.querySelector('.refresh-icon'); // Référence à l'icône (maintenant une image)
                const agencyUrl = $button.dataset.url;

                console.log('Refresh button clicked for URL:', agencyUrl);
                console.log('Icon element:', $icon); // Add this line to debug

                // Add rotating class to icon and disable button
                $icon.classList.add('rotating');
                $button.disabled = true;
                
                // Ajouter l'URL à la liste des agences en cours d'actualisation
                if (!refreshingAgencies.includes(agencyUrl)) {
                    refreshingAgencies.push(agencyUrl);
                }

                try {
                    const response = await fetch(oaw_data.ajax_url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            'action': 'oaw_refresh_lighthouse',
                            'agency_url': agencyUrl,
                            'nonce': oaw_data.refresh_nonce
                        })
                    });

                    const result = await response.json();

                    console.log('AJAX Result:', result);
                    if (result.success) {
                        alert('✅ OK ! Actualisation réussie pour: ' + agencyUrl);
                        loadResults(); // Reload all data and re-render table
                    } else {
                        alert(result.data || 'Une erreur inconnue est survenue.');
                    }
                } catch (error) {
                    console.error('Erreur AJAX:', error);
                    alert('Une erreur est survenue lors de l\'actualisation.');
                } finally {
                    // Retirer l'URL de la liste des agences en cours d'actualisation
                    const index = refreshingAgencies.indexOf(agencyUrl);
                    if (index > -1) {
                        refreshingAgencies.splice(index, 1);
                    }
                    
                    // Remove rotating class and re-enable button
                    $icon.classList.remove('rotating');
                    $button.disabled = false;
                }
            });
        });
    }

    function sortTable(column, order) {
        const sortedAgencies = [...allAgenciesData]; // Create a copy to avoid modifying original array

        sortedAgencies.sort((a, b) => {
            let valA, valB;

            // Handle nested properties for scores and carbon
            if (['performance', 'accessibility', 'best-practices', 'seo', 'carbon'].includes(column)) {
                valA = a.latestAudit.scores[column];
                valB = b.latestAudit.scores[column];
            } else if (column === 'date') {
                valA = new Date(a.latestAudit.date).getTime();
                valB = new Date(b.latestAudit.date).getTime();
            } else {
                valA = a[column];
                valB = b[column];
            }

            // Handle null/undefined values
            if (valA === undefined || valA === null) valA = (order === 'asc') ? Infinity : -Infinity;
            if (valB === undefined || valB === null) valB = (order === 'asc') ? Infinity : -Infinity;

            // Numeric comparison
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (order === 'asc') ? valA - valB : valB - valA;
            } else { // String comparison
                const strA = String(valA).toLowerCase();
                const strB = String(valB).toLowerCase();
                if (strA < strB) return (order === 'asc') ? -1 : 1;
                if (strA > strB) return (order === 'asc') ? 1 : -1;
                return 0;
            }
        });

        renderTable(sortedAgencies);
        updateSortIndicators();
    }

    function updateSortIndicators() {
        document.querySelectorAll('#agenciesTable th[data-sort]').forEach(header => {
            // On retire les classes de tri précédentes
            header.classList.remove('sort-asc', 'sort-desc');

            // On ajoute la classe correcte si c'est la colonne en cours de tri
            if (header.dataset.sort === currentSortColumn) {
                header.classList.add('sort-' + currentSortOrder);
            }
        });
    }

    function getScoreClass(score) {
        if (score >= 90) {
            return 'score high';
        } else if (score >= 50) {
            return 'score medium';
        } else {
            return 'score low';
        }
    }

    function getCarbonScoreClass(score) {
        // Assuming lower carbon footprint is better
        if (score <= 0.5) { // Example threshold for very low carbon
            return 'score high'; // Green
        } else if (score <= 1.5) { // Example threshold for medium carbon
            return 'score medium'; // Orange
        } else {
            return 'score low';
        }
    }

    function calculateCompositeScore(scores) {
        const lhScores = [
            scores.performance || 0,
            scores.accessibility || 0,
            scores['best-practices'] || 0,
            scores.seo || 0
        ];
        const averageLh = lhScores.reduce((sum, score) => sum + score, 0) / lhScores.length;
        const carbonScorePercentage = (scores.carbonCleanerThan || 0);
        const compositeScore = (averageLh * 0.7) + (carbonScorePercentage * 0.3); 
        return compositeScore;
    }
    
    loadResults();
});
