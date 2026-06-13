# 🌲 Camping RP [FR] — Bot Discord

Bot Discord complet pour le serveur **Camping RP [FR]**, incluant les commandes d'animation, de gestion du staff, et un système d'évaluation des modérateurs avec base de données SQLite.

---

## 📦 Installation

### Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- Un bot Discord créé sur le [Discord Developer Portal](https://discord.com/developers/applications)

### Étapes

```bash
# 1. Cloner ou déposer le projet
cd mon-dossier-bot

# 2. Installer les dépendances
npm install discord.js better-sqlite3

# 3. Configurer le script (voir section Configuration)

# 4. Lancer le bot
node bot_camping_with_notes.js
```

---

## ⚙️ Configuration

Ouvre `bot_camping_with_notes.js` et modifie les constantes en haut du fichier :

```js
const TOKEN            = 'TON_TOKEN_ICI';
const GUILD_ID         = 'ID_DE_TON_SERVEUR';
const LOG_CHANNEL_ID   = 'ID_DU_SALON_LOGS';
const NOTE_CATEGORY_ID = 'ID_DE_LA_CATEGORIE_NOTES';
```

| Variable | Description |
|---|---|
| `TOKEN` | Token de ton bot (Discord Developer Portal) |
| `GUILD_ID` | ID de ton serveur Discord |
| `LOG_CHANNEL_ID` | Salon où les logs sont envoyés automatiquement |
| `NOTE_CATEGORY_ID` | Catégorie dans laquelle les salons de notes seront créés |

> Pour obtenir un ID : active le **Mode Développeur** dans les paramètres Discord, puis fais clic droit sur l'élément.

---

## 🔐 Permissions requises

Le bot a besoin des permissions suivantes sur ton serveur :

- Lire les salons
- Envoyer des messages
- Gérer les salons (créer / supprimer)
- Gérer les permissions de salon
- Voir les membres du serveur
- Envoyer des messages privés

**Intents à activer** sur le Developer Portal (section *Bot*) :
- `Server Members Intent`
- `Message Content Intent`

---

## 🗂️ Base de données

Le bot crée automatiquement un fichier `moderator_notes.db` (SQLite) au premier lancement.

**Structure de la table `notes` :**

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | Identifiant unique auto-incrémenté |
| `user_id` | TEXT | ID Discord de l'utilisateur évalué |
| `mod_name` | TEXT | Nom du modérateur évalué |
| `mod_id` | TEXT | ID Discord du modérateur évalué |
| `note` | INTEGER | Note attribuée (0 à 10) |
| `avis` | TEXT | Texte de l'avis |
| `date` | TEXT | Date et heure au format français |

---

## 📋 Commandes

### 🌲 Informations générales

| Commande | Description | Permission |
|---|---|---|
| `/aide` | Affiche la liste de toutes les commandes | Tout le monde |
| `/reglement` | Affiche la charte officielle du serveur | Tout le monde |
| `/pub` | Poste le message de publicité du serveur | Tout le monde |
| `/reseaux` | Affiche les réseaux sociaux du camp | Tout le monde |
| `/boost` | Affiche les statistiques de boost du serveur | Tout le monde |
| `/meteo` | Génère une météo aléatoire pour le camp | Tout le monde |

### 🎭 Immersion & RP

| Commande | Description | Permission |
|---|---|---|
| `/exploration` | Explore les bois et découvre un objet aléatoire | Tout le monde |
| `/story` | Révèle une légende mystérieuse du camp | Tout le monde |
| `/marshmallow @membre` | Offre un marshmallow à un autre campeur | Tout le monde |

### 🛡️ Administration

| Commande | Description | Permission |
|---|---|---|
| `/staff-on` | Ouvre les recrutements Staff | Administrateur |
| `/staff-off` | Ferme les recrutements Staff | Administrateur |
| `/dev-on` | Ouvre les recrutements Technique | Administrateur |
| `/dev-off` | Ferme les recrutements Technique | Administrateur |
| `/staff-forme` | Affiche le formulaire de candidature | Tout le monde |
| `/embed` | Crée une annonce personnalisée | Administrateur |
| `/mp tous/solo` | Envoie un message en DM à tous ou à un membre | Administrateur |

### ⭐ Système de Notes

| Commande | Description | Permission |
|---|---|---|
| `/note @utilisateur` | Crée un salon de ticket d'évaluation | Administrateur |
| `/moyenne @mod` | Affiche la moyenne d'un modérateur | Tout le monde |
| `/topmods` | Classement des 10 meilleurs modérateurs | Tout le monde |
| `/avis @utilisateur` | Historique des avis reçus | Tout le monde |

---

## ⭐ Fonctionnement du système de notes

1. Un administrateur utilise `/note @utilisateur` pour ouvrir un ticket.
2. Un salon privé `note-pseudo` est créé dans la catégorie configurée.
3. L'utilisateur (ou toute personne ayant accès) clique sur **"Donner mon avis"**.
4. Un menu déroulant apparaît pour **choisir le modérateur** à évaluer.
5. Un formulaire s'ouvre pour saisir une **note (0–10)** et un **avis détaillé**.
6. L'évaluation est sauvegardée en base de données et un log est envoyé automatiquement.
7. Le salon est **supprimé automatiquement** 3 secondes après la soumission.

---

## 📁 Structure du projet

```
mon-dossier-bot/
├── bot_camping_with_notes.js   # Fichier principal du bot
├── moderator_notes.db          # Base de données SQLite (créée au lancement)
├── package.json                # Dépendances Node.js
└── README.md                   # Ce fichier
```

---

## 🛠️ Dépendances

| Package | Version recommandée | Utilité |
|---|---|---|
| `discord.js` | ^14.x | Librairie Discord |
| `better-sqlite3` | ^9.x | Base de données SQLite synchrone |

---

## ❓ Problèmes fréquents

**Le bot ne répond pas aux commandes slash**
> Vérifie que `GUILD_ID` est correct et attends 1 à 2 minutes après le lancement pour que les commandes se synchronisent.

**Erreur `Cannot find module 'better-sqlite3'`**
> Lance `npm install better-sqlite3` dans le dossier du projet.

**Le salon de note ne se crée pas**
> Vérifie que `NOTE_CATEGORY_ID` est bien configuré et que le bot a la permission de gérer les salons.

**Les DM massifs échouent pour certains membres**
> C'est normal : Discord bloque les DM des membres ayant désactivé les messages privés. Ces échecs sont ignorés silencieusement.

---

## 📄 Licence

Projet privé — Camping RP [FR]. Toute redistribution est interdite sans autorisation.
