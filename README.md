# Observatoire des Agences Web - Plugin WordPress

Ce plugin WordPress permet de créer un tableau de classement dynamique des agences web (ou de tout autre site) en se basant sur des indicateurs de performance clés issus de Google PageSpeed Insights et de Website Carbon API.

## Fonctionnalités

*   **Classement dynamique** : Affiche un tableau triable par score.
*   **Métriques complètes** : Analyse la performance, l'accessibilité, les bonnes pratiques et le SEO via l'API Google PageSpeed.
*   **Score Carbone** : Intègre l'empreinte carbone de chaque site via l'API Website Carbon.
*   **Score Composite** : Calcule un score global pondéré pour un classement équilibré.
*   **Mise à jour en direct** : Un bouton "Refresh" permet de relancer un audit pour une agence spécifique sans recharger la page (via AJAX).
*   **Installation facile** : S'intègre simplement à n'importe quelle page ou article via un shortcode.
*   **Personnalisable** : La liste des agences à auditer est gérée via un simple fichier JSON.

## Installation

1.  **Téléchargez le plugin** : Récupérez la dernière version du plugin depuis la page [Releases](https://github.com/your-username/your-repo-name/releases) de ce dépôt GitHub (cliquez sur `Source code (zip)`).
2.  **Allez sur votre site WordPress** : Dans votre tableau de bord, allez dans `Extensions` > `Ajouter`.
3.  **Téléversez le plugin** : Cliquez sur `Téléverser une extension` et sélectionnez le fichier `.zip` que vous venez de télécharger.
4.  **Activez le plugin** : Une fois l'installation terminée, cliquez sur `Activer`.

## Configuration

### 1. Clé d'API Google PageSpeed

Pour que le plugin puisse fonctionner, vous devez fournir votre propre clé d'API Google PageSpeed. Pour des raisons de sécurité, il est fortement recommandé de la définir dans votre fichier `wp-config.php`.

Ajoutez la ligne suivante à votre fichier `wp-config.php` (situé à la racine de votre installation WordPress) :

```php
define('OAW_GOOGLE_API_KEY', 'VOTRE_CLE_API_GOOGLE_ICI');
```

### 2. Liste des agences

Créez un fichier nommé `agencies.json` et placez-le à la racine du dossier du plugin (`/wp-content/plugins/observatoire-agences-web/`).

Ce fichier doit contenir la liste des agences à analyser, sous le format suivant :

```json
[
  {
    "name": "Nom de l'Agence 1",
    "url": "https://www.agence1.fr"
  },
  {
    "name": "Nom de l'Agence 2",
    "url": "https://www.agence2.com"
  },
  {
    "name": "Autre Site Web",
    "url": "https://www.autresite.net"
  }
]
```

Le plugin générera et mettra à jour automatiquement un fichier `lighthouse-results.json` dans ce même dossier pour stocker les résultats des audits.

## Utilisation

Pour afficher le tableau de l'observatoire, insérez simplement le shortcode suivant dans le contenu d'une page, d'un article ou d'un widget texte :

`[observatoire_agences_web]`

## Contribuer

Les contributions sont les bienvenues ! Si vous souhaitez améliorer ce plugin, n'hésitez pas à forker le dépôt et à soumettre une Pull Request.

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.
