# Moderator Notes Bot (Discord)

Bot Discord en un seul script Python pour évaluer les modérateurs via des tickets privés.

## Prérequis
- Python 3.10+
- pip install discord.py

## Installation
1. Copier `moderator_notes_bot.py` dans le même dossier.
2. Modifier la configuration en haut du fichier :
   - TOKEN
   - MOD_ROLE_ID
   - CATEGORY_ID
   - LOGS_CHANNEL_ID
3. Installer la dépendance :

```bash
pip install -U discord.py
```

## Lancer le bot
```bash
python moderator_notes_bot.py
```

Le bot crée automatiquement `moderator_notes.db` pour stocker les notes.

## Commandes slash
- `/note @user` — crée un salon privé pour évaluer l'utilisateur (réservé aux modérateurs).
- `/moyenne mod_name` — affiche la moyenne des notes d'un modérateur.
- `/topmods` — affiche le top 10 des modérateurs.
- `/avis @user` — affiche l'historique des avis donnés par un utilisateur.

## Permissions requises du bot
- Manage Channels (pour créer/supprimer des salons)
- Send Messages, Embed Links, Read Message History
- Members intent activé dans le Developer Portal

## Sécurité & remarques
- Assurez-vous d'entrer les bons IDs (role, category, logs). 
- Le script empêche la création de plusieurs salons pour le même utilisateur et valide les notes (0–10).
