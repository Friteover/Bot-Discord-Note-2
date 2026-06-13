const {
    Client,
    GatewayIntentBits,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    PermissionsBitField,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    Collection
} = require('discord.js');

const Database = require('better-sqlite3');

// ============================================
// CONFIGURATION
// ============================================

const TOKEN = '';
const GUILD_ID = '1321206788078436383';
const LOG_CHANNEL_ID = '1431328671062429780';
const NOTE_CATEGORY_ID = 'ID_CATEGORIE_ICI'; // ← Remplace par l'ID de ta catégorie pour les salons de notes

// ============================================
// CONSTANTES VISUELLES
// ============================================

const BARRE = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';
const BARRE_COURTE = '▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬';

const COLORS = {
    MAIN:   '#2ecc71',
    DANGER: '#e74c3c',
    INFO:   '#3498db',
    TIKTOK: '#ee1d52',
    BOOST:  '#f47fff',
    GOLD:   '#f1c40f',
    STORY:  '#8e44ad'
};

// ============================================
// BASE DE DONNÉES (better-sqlite3)
// ============================================

const db = new Database('moderator_notes.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id   TEXT NOT NULL,
        mod_name  TEXT NOT NULL,
        mod_id    TEXT NOT NULL,
        note      INTEGER NOT NULL,
        avis      TEXT NOT NULL,
        date      TEXT NOT NULL
    )
`);

// Helpers DB
function dbAddNote(userId, modName, modId, note, avis) {
    const date = new Date().toLocaleString('fr-FR');
    db.prepare(`
        INSERT INTO notes (user_id, mod_name, mod_id, note, avis, date)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(String(userId), modName, String(modId), note, avis, date);
}

function dbGetModAverage(modId) {
    const rows = db.prepare('SELECT note FROM notes WHERE mod_id = ?').all(String(modId));
    if (!rows.length) return { avg: 0, count: 0 };
    const avg = rows.reduce((s, r) => s + r.note, 0) / rows.length;
    return { avg: Math.round(avg * 100) / 100, count: rows.length };
}

function dbGetTopMods() {
    return db.prepare(`
        SELECT mod_name, mod_id, ROUND(AVG(note), 2) as avg, COUNT(*) as count
        FROM notes
        GROUP BY mod_id
        ORDER BY avg DESC
        LIMIT 10
    `).all();
}

function dbGetUserAvis(userId) {
    return db.prepare(`
        SELECT mod_name, avis, note, date
        FROM notes
        WHERE user_id = ?
        ORDER BY id DESC
    `).all(String(userId));
}

// ============================================
// CLIENT
// ============================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============================================
// READY & SYNC COMMANDES
// ============================================

client.once(Events.ClientReady, async (c) => {
    console.log(`\n${BARRE}`);
    console.log(`✨ [READY] ${c.user.tag.toUpperCase()} EST OPÉRATIONNELLE`);
    console.log(`🌲 [GUILD] Surveillance active sur l'ID : ${GUILD_ID}`);
    console.log(`${BARRE}\n`);

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return console.error('❌ Erreur critique : Guilde introuvable.');

    try {
        await guild.commands.set([
            // --- Commandes Camping RP existantes ---
            { name: 'reglement',   description: '📜 La Charte Sacrée : Droits et Devoirs des campeurs' },
            { name: 'pub',         description: '📢 Message d\'invitation officiel du Camp' },
            { name: 'reseaux',     description: '📱 Accès direct au TikTok et plateformes sociales' },
            { name: 'staff-on',    description: '🟢 Lancement officiel des recrutements Staff' },
            { name: 'staff-off',   description: '🔴 Clôture des sessions de recrutement Staff' },
            { name: 'dev-on',      description: '🛠️ Recherche de nouveaux bâtisseurs (Pôle Technique)' },
            { name: 'dev-off',     description: '✖️ Fin des recrutements Technique' },
            { name: 'staff-forme', description: '📝 Formulaire interactif de candidature' },
            { name: 'embed',       description: '🖼️ Interface de création d\'annonces visuelles' },
            { name: 'boost',       description: '🚀 État des réacteurs de puissance (Boosters)' },
            { name: 'meteo',       description: '🌡️ Analyse météorologique de la région' },
            { name: 'exploration', description: '🗺️ S\'enfoncer dans les bois à la recherche de trésors' },
            { name: 'story',       description: '📖 Une des 40 légendes oubliées du camp' },
            { name: 'marshmallow', description: '🍡 Partager une douceur au coin du feu', options: [{ name: 'cible', type: 6, description: 'Le campeur à gâter', required: true }] },
            { name: 'aide',        description: '❓ Liste complète des outils du Guide' },
            {
                name: 'mp',
                description: '📩 Diffusion Radio (Tous ou Solo)',
                options: [
                    { name: 'cible', type: 3, description: 'À qui envoyer ?', required: true, choices: [{ name: 'Tout le monde', value: 'tous' }, { name: 'Un seul membre (ID)', value: 'solo' }] },
                    { name: 'id_membre', type: 3, description: 'Si solo, ID du membre ici', required: false }
                ]
            },

            // --- Nouvelles commandes : Système de Notes ---
            {
                name: 'note',
                description: '⭐ Créer un ticket d\'évaluation pour un utilisateur (Admin)',
                options: [{ name: 'utilisateur', type: 6, description: 'L\'utilisateur à évaluer', required: true }]
            },
            {
                name: 'moyenne',
                description: '📊 Afficher la moyenne des notes d\'un modérateur',
                options: [{ name: 'mod', type: 6, description: 'Le modérateur', required: true }]
            },
            {
                name: 'topmods',
                description: '🏆 Afficher le classement des meilleurs modérateurs'
            },
            {
                name: 'avis',
                description: '📝 Afficher l\'historique des avis donnés sur un utilisateur',
                options: [{ name: 'utilisateur', type: 6, description: 'L\'utilisateur', required: true }]
            }
        ]);
        console.log('💎 [SYSTEM] : 20 Commandes synchronisées avec succès.');
    } catch (error) {
        console.error('❌ [ERROR] Échec de la synchronisation des commandes :', error);
    }
});

// ============================================
// LOGS INTERNES
// ============================================

async function sendToLogs(interaction, title, description, color = COLORS.MAIN) {
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
        .setAuthor({ name: 'SYSTÈME DE SURVEILLANCE DU CAMP', iconURL: interaction.guild.iconURL() })
        .setTitle(title)
        .setDescription(`${BARRE_COURTE}\n${description}\n${BARRE_COURTE}`)
        .setColor(color)
        .addFields(
            { name: '👤 Utilisateur', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true },
            { name: '📍 Salon',       value: `#${interaction.channelId}`,                            inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'ID de session : ' + Math.random().toString(36).substr(2, 9).toUpperCase() });

    logChannel.send({ embeds: [logEmbed] }).catch(console.error);
}

// ============================================
// INTERACTIONS
// ============================================

client.on(Events.InteractionCreate, async (interaction) => {

    // ==========================================
    // SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {

        // ---- AIDE ----
        if (interaction.commandName === 'aide') {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'GUIDE DU CAMP • PANNEAU D\'ASSISTANCE', iconURL: client.user.displayAvatarURL() })
                .setColor(COLORS.INFO)
                .setDescription(`Bienvenue, voyageur. Voici les outils à ta disposition.\n\n${BARRE}`)
                .addFields(
                    { name: '🌲 INFORMATIONS',      value: '`/reglement` `/pub` `/reseaux` `/boost` `/meteo`',                inline: false },
                    { name: '🎭 IMMERSION & RP',    value: '`/exploration` `/story` `/marshmallow`',                          inline: false },
                    { name: '🛡️ ADMINISTRATION',    value: '`/staff-on` `/staff-off` `/dev-on` `/dev-off` `/mp` `/embed`',   inline: false },
                    { name: '⭐ NOTES & ÉVALUATIONS', value: '`/note` `/moyenne` `/topmods` `/avis`',                          inline: false }
                )
                .setFooter({ text: 'Besoin de plus d\'aide ? Contactez un membre de la Direction.' });
            return interaction.reply({ embeds: [embed] });
        }

        // ---- RÉSEAUX ----
        if (interaction.commandName === 'reseaux') {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'CAMPING RP [FR] • RÉSEAUX SOCIAUX', iconURL: 'https://i.imgur.com/8Qp7ZpB.gif' })
                .setTitle('📽️ LE CAMPING DÉBARQUE SUR TIKTOK !')
                .setColor(COLORS.TIKTOK)
                .setDescription(`${BARRE}\n\n✨ Plongez au cœur de la création !\nDécouvrez les coulisses, des leaks exclusifs et les meilleurs moments RP.\n\n${BARRE}`)
                .addFields(
                    { name: '📘 Identifiant', value: '👉 `@camping_rp_fr`', inline: true },
                    { name: '🚀 Objectif',    value: '10k Campeurs',         inline: true }
                )
                .setImage('https://i.imgur.com/8Qp7ZpB.gif')
                .setFooter({ text: 'Merci pour votre soutien ! ❤️', iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Accéder au TikTok').setStyle(ButtonStyle.Link).setURL('https://www.tiktok.com/@camping_rp_fr').setEmoji('🎬')
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // ---- BOOST ----
        if (interaction.commandName === 'boost') {
            const count = interaction.guild.premiumSubscriptionCount || 0;
            const tier  = interaction.guild.premiumTier;
            const embed = new EmbedBuilder()
                .setAuthor({ name: `${interaction.user.username} consulte les statistiques`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle('🚀 ÉNERGIE DU CAMPEMENT')
                .setColor(COLORS.BOOST)
                .setDescription(`Grâce à votre générosité, le campement évolue.\n\n${BARRE}`)
                .addFields(
                    { name: '💎 BOOSTS',       value: `${count} Boosts actuels`, inline: true },
                    { name: '📈 NIVEAU',        value: `Palier ${tier}`,          inline: true },
                    { name: '✨ AVANTAGES',     value: '• Audio supérieur\n• Emotes perso\n• Bannière serveur', inline: false }
                )
                .setFooter({ text: 'Merci infiniment aux boosters !' })
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        // ---- PUB ----
        if (interaction.commandName === 'pub') {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'COMMUNIQUÉ OFFICIEL – CAMPING RP [FR]', iconURL: interaction.guild.iconURL() })
                .setTitle('🌲 UNE EXPÉRIENCE RP UNIQUE VOUS ATTEND 🌲')
                .setColor(COLORS.MAIN)
                .setDescription(`${BARRE}\n\n✨ Loin du tumulte de la ville, un havre de paix vous ouvre ses portes sur Roblox.\n\n${BARRE}`)
                .addFields(
                    { name: '⛺ INCARNEZ VOTRE DESTIN', value: '🔹 Vacancier\n🔹 Gérant\n🔹 Animateur\n🔹 Secouriste', inline: false },
                    { name: '🔥 POURQUOI NOUS REJOINDRE ?', value: '✅ Développement constant\n✅ Équipe sérieuse\n✅ Événements réguliers\n✅ Map inédite', inline: false },
                    { name: '🔗 VOTRE BILLET D\'ENTRÉE', value: '👉 [Rejoindre le campement](https://discord.gg/nNJC6ERtpM)', inline: false }
                )
                .setFooter({ text: 'Camping RP [FR] • Plus de 2000 membres nous font confiance.', iconURL: interaction.guild.iconURL() });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Rejoindre l\'aventure').setStyle(ButtonStyle.Link).setURL('https://discord.gg/nNJC6ERtpM').setEmoji('🔗')
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // ---- STAFF-ON ----
        if (interaction.commandName === 'staff-on') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply({ content: '❌ Seule la Direction peut initier cette phase.', ephemeral: true });
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Information Recrutement – Camping RP', iconURL: interaction.guild.iconURL() })
                .setTitle('🟢 RECRUTEMENTS STAFF : OUVERTS')
                .setColor(COLORS.MAIN)
                .setDescription(`${BARRE}\n\nNous recherchons des âmes dévouées pour maintenir l'ordre et la joie.\n\n⚠️ L'usage de l'IA, le plagiat ou le mensonge entraînent un refus immédiat.\n\n${BARRE}`)
                .addFields(
                    { name: '📋 POSTES', value: '• Modérateur\n• Helper\n• Animateur', inline: true },
                    { name: '📖 PROCÉDURE', value: '1️⃣ Cliquez sur `/staff-forme`\n2️⃣ Répondez honnêtement\n3️⃣ Attendez la réponse.', inline: true }
                )
                .setFooter({ text: 'Session active • Bonne chance à tous !' })
                .setTimestamp();
            await interaction.channel.send({ embeds: [embed] });
            await sendToLogs(interaction, '🟢 OUVERTURE DES RECRUTEMENTS', 'La Direction a ouvert les candidatures Staff.');
            return interaction.reply({ content: '✅ Annonce postée.', ephemeral: true });
        }

        // ---- STAFF-OFF ----
        if (interaction.commandName === 'staff-off') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply({ content: '❌ Action réservée.', ephemeral: true });
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Information Recrutement – Camping RP', iconURL: interaction.guild.iconURL() })
                .setTitle('🔴 RECRUTEMENTS STAFF : FERMÉS')
                .setColor(COLORS.DANGER)
                .setDescription(`${BARRE}\n\nLes sessions sont terminées. Les résultats seront annoncés en privé.\n\n${BARRE}`);
            await interaction.channel.send({ embeds: [embed] });
            await sendToLogs(interaction, '🔴 FERMETURE DES RECRUTEMENTS', 'La Direction a fermé les candidatures Staff.', COLORS.DANGER);
            return interaction.reply({ content: '✅ Fermé.', ephemeral: true });
        }

        // ---- DEV-ON ----
        if (interaction.commandName === 'dev-on') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply({ content: '❌ Action réservée.', ephemeral: true });
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'RECRUTEMENTS TECHNIQUES – CAMPING RP [FR]', iconURL: interaction.guild.iconURL() })
                .setTitle('🛠️ L\'ÉQUIPE TECHNIQUE RECHERCHE DES TALENTS')
                .setColor(COLORS.INFO)
                .setDescription(`${BARRE}\n\nProfils recherchés :\n• Scripteurs Lua\n• Builders\n• Modélisateurs 3D\n• GFX & Artistes 2D\n\n${BARRE}`)
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Déposer son Portfolio').setStyle(ButtonStyle.Link).setURL('https://docs.google.com/forms/').setEmoji('📝')
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            await sendToLogs(interaction, '🛠️ RECRUTEMENT DEV ON', 'Appel aux talents techniques lancé.');
            return interaction.reply({ content: '✅ Lancé.', ephemeral: true });
        }

        // ---- DEV-OFF ----
        if (interaction.commandName === 'dev-off') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply({ content: '❌ Action réservée.', ephemeral: true });
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'RECRUTEMENTS TECHNIQUES – CAMPING RP [FR]', iconURL: interaction.guild.iconURL() })
                .setTitle('🛠️ FERMETURE DES RECRUTEMENTS')
                .setColor(COLORS.INFO)
                .setDescription(`${BARRE}\n\nLes sessions sont terminées. Merci à tous les candidats.\n\n${BARRE}`)
                .setTimestamp();
            await interaction.channel.send({ embeds: [embed] });
            await sendToLogs(interaction, '🛠️ RECRUTEMENT DEV OFF', 'Recrutement technique fermé.');
            return interaction.reply({ content: '✅ Fermé.', ephemeral: true });
        }

        // ---- STAFF-FORME ----
        if (interaction.commandName === 'staff-forme') {
            const modal = new ModalBuilder().setCustomId('staff_modal').setTitle('DOSSIER DE CANDIDATURE - STAFF');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('age').setLabel('Quel est votre âge ?').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(2).setPlaceholder('Ex: 17').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motiv').setLabel('Motivations (SANS IA - MIN 100 MOTS)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Décrivez pourquoi vous souhaitez rejoindre...').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('experience').setLabel('Expériences passées').setStyle(TextInputStyle.Paragraph).setPlaceholder('Avez-vous déjà été staff ? Où ?').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dispo').setLabel('Disponibilités hebdomadaires').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Soirs et Week-ends').setRequired(true))
            );
            return interaction.showModal(modal);
        }

        // ---- MÉTÉO ----
        if (interaction.commandName === 'meteo') {
            const types = [
                { t: 'Ciel Dégagé & Soleil',  c: COLORS.GOLD,   d: 'Le soleil brille intensément. Pensez à l\'hydratation !',               temp: '28°C' },
                { t: 'Nuit Étoilée Magique',   c: '#2c3e50',     d: 'La Voie Lactée est visible à l\'œil nu.',                               temp: '16°C' },
                { t: 'Orage Tropical',         c: COLORS.DANGER, d: 'Attention ! La foudre gronde. Restez à l\'abri.',                       temp: '22°C' },
                { t: 'Brouillard Mystique',    c: '#95a5a6',     d: 'La visibilité est presque nulle. Des choses étranges apparaissent...', temp: '14°C' }
            ];
            const current = types[Math.floor(Math.random() * types.length)];
            const embed = new EmbedBuilder()
                .setAuthor({ name: interaction.user.username + ' consulte la météo', iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🌡️ BULLETIN MÉTÉO : ${current.t}`)
                .setColor(current.c)
                .setDescription(`${BARRE}\n\n${current.d}\n\n${BARRE}`)
                .addFields(
                    { name: '📍 Secteur',      value: 'Vallée des Sapins',                                    inline: true },
                    { name: '💧 Humidité',     value: `${Math.floor(Math.random() * 60 + 20)}%`,              inline: true },
                    { name: '🌡️ Température', value: current.temp,                                            inline: true }
                )
                .setFooter({ text: 'Actualisé par le Guide du Camp • Station Est' })
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        // ---- EXPLORATION ----
        if (interaction.commandName === 'exploration') {
            const lieux  = ['la grotte oubliée', 'les ruines du vieux barrage', 'le sommet du Pic Rocheux', 'la clairière aux lucioles'];
            const objets = ['un vieux couteau de poche', 'une boussole en cuivre', 'un carnet de notes jauni', 'une pépite d\'or', 'une branche sculptée'];
            const lieu  = lieux[Math.floor(Math.random()  * lieux.length)];
            const objet = objets[Math.floor(Math.random() * objets.length)];
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'GUIDE D\'EXPLORATION', iconURL: interaction.user.displayAvatarURL() })
                .setTitle('🧭 AVENTURE DANS LES BOIS')
                .setColor(COLORS.MAIN)
                .setDescription(`${BARRE}\n\nTu t'es aventuré vers **${lieu}**.\nAprès quelques heures de marche, tu as découvert : **${objet}** !\n\n${BARRE}`)
                .setFooter({ text: 'L\'exploration est risquée, ne partez jamais seul.' });
            return interaction.reply({ embeds: [embed] });
        }

        // ---- MARSHMALLOW ----
        if (interaction.commandName === 'marshmallow') {
            const cible = interaction.options.getUser('cible');
            const embed = new EmbedBuilder()
                .setTitle('🍡 MOMENT DE CONVIVIALITÉ')
                .setDescription(`${interaction.user.username} a fait griller un marshmallow parfaitement doré pour ${cible.username} !\n\nLa chaleur du feu de camp renforce vos liens.`)
                .setColor(COLORS.GOLD)
                .setFooter({ text: 'Partagez la douceur du camping.' });
            return interaction.reply({ content: `<@${cible.id}>`, embeds: [embed] });
        }

        // ---- STORY ----
        if (interaction.commandName === 'story') {
            const stories = [
                '🌲 **Légende 1** : On dit qu\'en 1962, un groupe de scouts a disparu près du lac. Leurs rires s\'entendent encore les soirs de brouillard.',
                '🛶 **Légende 2** : Un canoë vide traverserait le lac toutes les nuits sans rameur. Si vous montez dedans, vous ne reviendrez jamais.',
                '🦉 **Légende 3** : Le Hibou Blanc n\'est pas un oiseau. C\'est l\'esprit de l\'ancien gardien qui surveille ceux qui polluent la forêt.',
                '👣 **Légende 4** : Des empreintes géantes ont été vues vers la grotte. Elles ne sont ni d\'un ours, ni d\'un homme.',
                '📻 **Légende 5** : Si vous allumez votre radio sur la fréquence 99.9 à minuit, une voix vous donnera l\'heure de votre propre départ.',
                '🔥 **Légende 6** : Le feu de camp central ne s\'éteint jamais de lui-même. Si la flamme devient bleue, fuyez le camp immédiatement.',
                '⛺ **Légende 7** : La tente numéro 13 n\'existe pas sur le plan, mais certains campeurs disent s\'y être réveillés sans souvenir.',
                '🦌 **Légende 8** : Le cerf aux bois d\'argent n\'apparaît qu\'à ceux qui ont le cœur pur. Le suivre mène à un trésor caché.',
                '🔦 **Légende 9** : Ne visez jamais les bois profonds avec votre lampe trop longtemps. Quelque chose pourrait viser en retour.',
                '🌫️ **Légende 10** : La brume n\'est pas de l\'eau. C\'est le souffle de la montagne qui cherche à vous isoler de vos amis.'
            ];
            const story = stories[Math.floor(Math.random() * stories.length)];
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'LES MYSTÈRES DU CAMPING', iconURL: interaction.guild.iconURL() })
                .setTitle('📖 UNE LÉGENDE OUBLIÉE...')
                .setColor(COLORS.STORY)
                .setDescription(`${BARRE}\n\n${story}\n\n${BARRE}`)
                .setFooter({ text: 'Vrai ou faux ? À vous d\'en juger...' });
            return interaction.reply({ embeds: [embed] });
        }

        // ---- REGLEMENT ----
        if (interaction.commandName === 'reglement') {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'CHARTE OFFICIELLE DU CAMPEUR', iconURL: interaction.guild.iconURL() })
                .setTitle('📜 RÈGLES DE VIE & SÉCURITÉ')
                .setColor('#2c3e50')
                .setDescription(`${BARRE}\n\nBienvenue parmi nous. Pour que l\'expérience reste agréable :\n\n${BARRE}`)
                .addFields(
                    { name: '⚖️ DISCIPLINE',        value: '• Respect total\n• Pas d\'insultes\n• Pas de spam',                            inline: false },
                    { name: '🌲 IMMERSION RP',       value: '• Pas de MetaGaming\n• Pas de PowerGaming\n• Fair-play obligatoire',           inline: false },
                    { name: '🛡️ SÉCURITÉ',           value: '• Interdiction stricte de l\'IA pour candidatures\n• Protection des données', inline: false }
                )
                .setFooter({ text: 'Tout manquement entraînera une sanction irrévocable.' });
            await interaction.channel.send({ embeds: [embed] });
            return interaction.reply({ content: '✅ Charte affichée avec succès.', ephemeral: true });
        }

        // ---- MP ----
        if (interaction.commandName === 'mp') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply({ content: '❌ Accès Radio refusé : Permission manquante.', ephemeral: true });

            const cible  = interaction.options.getString('cible');
            const userId = interaction.options.getString('id_membre');

            if (cible === 'solo' && !userId)
                return interaction.reply({ content: '❌ ID manquant pour le mode solo.', ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId(cible === 'tous' ? 'mp_modal_all' : `mp_modal_solo_${userId}`)
                .setTitle(cible === 'tous' ? '📻 DIFFUSION À TOUS' : '📩 MP SOLO');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('msg_content').setLabel('Message à diffuser').setStyle(TextInputStyle.Paragraph).setMinLength(10).setPlaceholder('Écrivez le message ici...').setRequired(true)
                )
            );
            return interaction.showModal(modal);
        }

        // ---- EMBED ----
        if (interaction.commandName === 'embed') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply({ content: '❌ Accès Studio refusé.', ephemeral: true });

            const modal = new ModalBuilder().setCustomId('embed_modal').setTitle('STUDIO DE CRÉATION D\'ANNONCE');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e_t').setLabel('Titre de l\'annonce').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e_d').setLabel('Contenu du message').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e_c').setLabel('Code Couleur Hex (ex: #2ecc71)').setStyle(TextInputStyle.Short).setPlaceholder('#ffffff').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e_i').setLabel('Lien de l\'image (URL)').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return interaction.showModal(modal);
        }

        // ==========================================
        // ⭐ NOUVELLES COMMANDES : SYSTÈME DE NOTES
        // ==========================================

        // ---- /note ----
        if (interaction.commandName === 'note') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });

            const utilisateur = interaction.options.getUser('utilisateur');

            // Vérifier si un salon existe déjà
            const existing = interaction.guild.channels.cache.find(c => c.name === `note-${utilisateur.username.toLowerCase()}`);
            if (existing)
                return interaction.reply({ content: `❌ Un salon d\'évaluation existe déjà pour ${utilisateur.mention}`, ephemeral: true });

            const category = interaction.guild.channels.cache.get(NOTE_CATEGORY_ID);
            if (!category)
                return interaction.reply({ content: '❌ Catégorie non trouvée. Configure NOTE_CATEGORY_ID dans le script.', ephemeral: true });

            const overwrites = [
                { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: utilisateur.id,          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: interaction.user.id,     allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: interaction.guild.ownerId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ];

            const channel = await interaction.guild.channels.create({
                name: `note-${utilisateur.username.toLowerCase()}`,
                parent: category.id,
                permissionOverwrites: overwrites
            });

            const embed = new EmbedBuilder()
                .setTitle(`⭐ Évaluation de ${utilisateur.username}`)
                .setDescription('Cliquez sur le bouton ci-dessous pour donner votre avis sur ce modérateur.')
                .setColor(COLORS.INFO)
                .setThumbnail(utilisateur.displayAvatarURL());

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`note_btn_${utilisateur.id}`)
                    .setLabel('Donner mon avis')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⭐')
            );

            await channel.send({ embeds: [embed], components: [row] });
            await sendToLogs(interaction, '⭐ TICKET D\'ÉVALUATION CRÉÉ', `Ticket créé pour ${utilisateur.tag} par ${interaction.user.tag}.`);
            return interaction.reply({ content: `✅ Salon de note créé : ${channel}`, ephemeral: true });
        }

        // ---- /moyenne ----
        if (interaction.commandName === 'moyenne') {
            const mod = interaction.options.getUser('mod');
            const { avg, count } = dbGetModAverage(mod.id);

            if (count === 0)
                return interaction.reply({ content: `📊 **${mod.username}** n\'a pas encore reçu d\'évaluation.`, ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle(`📊 Statistiques de ${mod.username}`)
                .setDescription(`⭐ **Moyenne** : ${avg}/10\n📝 **Nombre d\'évaluations** : ${count}`)
                .setColor(COLORS.GOLD)
                .setThumbnail(mod.displayAvatarURL());
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ---- /topmods ----
        if (interaction.commandName === 'topmods') {
            const results = dbGetTopMods();

            if (!results.length)
                return interaction.reply({ content: '📊 Aucune évaluation enregistrée.', ephemeral: true });

            const description = results.map((r, i) =>
                `${i + 1}. **${r.mod_name}** — ⭐ ${r.avg}/10 (${r.count} éval${r.count > 1 ? 's' : ''})`
            ).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🏆 Top 10 Modérateurs')
                .setDescription(description)
                .setColor(COLORS.GOLD);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ---- /avis ----
        if (interaction.commandName === 'avis') {
            const utilisateur = interaction.options.getUser('utilisateur');
            const avisList = dbGetUserAvis(utilisateur.id);

            if (!avisList.length)
                return interaction.reply({ content: `📝 Aucun avis trouvé pour **${utilisateur.username}**`, ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle(`📋 Historique des avis — ${utilisateur.username}`)
                .setColor(COLORS.INFO);

            for (const { mod_name, avis, note, date } of avisList.slice(0, 10)) {
                embed.addFields({ name: `${mod_name} — ⭐ ${note}/10`, value: `${avis}\n*${date}*`, inline: false });
            }

            if (avisList.length > 10)
                embed.setFooter({ text: `Affichage des 10 derniers avis sur ${avisList.length} au total.` });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // ==========================================
    // BOUTON : Donner mon avis (ticket de note)
    // ==========================================
    if (interaction.isButton() && interaction.customId.startsWith('note_btn_')) {
        const evalUserId = interaction.customId.replace('note_btn_', '');

        // Récupérer les membres avec le rôle Admin (ou adapte selon ton rôle MOD)
        await interaction.guild.members.fetch();
        const adminMembers = interaction.guild.members.cache.filter(m =>
            m.permissions.has(PermissionsBitField.Flags.Administrator) && !m.user.bot
        );

        if (!adminMembers.size)
            return interaction.reply({ content: '❌ Aucun modérateur trouvé.', ephemeral: true });

        const options = adminMembers.first(25).map(m =>
            new StringSelectMenuOptionBuilder().setLabel(m.user.username).setValue(`${m.id}__${evalUserId}`)
        );

        const select = new StringSelectMenuBuilder()
            .setCustomId('note_select_mod')
            .setPlaceholder('Sélectionnez le modérateur à évaluer')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.reply({ content: '📋 Quel modérateur souhaitez-vous évaluer ?', components: [row], ephemeral: true });
    }

    // ==========================================
    // SELECT MENU : Choix du modérateur
    // ==========================================
    if (interaction.isStringSelectMenu() && interaction.customId === 'note_select_mod') {
        const [modId, evalUserId] = interaction.values[0].split('__');
        const mod = await interaction.guild.members.fetch(modId).catch(() => null);
        if (!mod)
            return interaction.reply({ content: '❌ Modérateur introuvable.', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId(`note_modal_${modId}__${evalUserId}`)
            .setTitle(`Évaluer ${mod.user.username}`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('note_value')
                    .setLabel('Note (0 à 10)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ex: 8')
                    .setMinLength(1)
                    .setMaxLength(2)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('note_avis')
                    .setLabel('Votre avis détaillé')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Donnez votre avis sur ce modérateur...')
                    .setMinLength(10)
                    .setMaxLength(2000)
                    .setRequired(true)
            )
        );

        return interaction.showModal(modal);
    }

    // ==========================================
    // MODALS
    // ==========================================
    if (interaction.isModalSubmit()) {

        // ---- Modal : Évaluation de note ----
        if (interaction.customId.startsWith('note_modal_')) {
            const parts    = interaction.customId.replace('note_modal_', '').split('__');
            const modId    = parts[0];
            const evalUserId = parts[1];

            const noteRaw = interaction.fields.getTextInputValue('note_value');
            const avis    = interaction.fields.getTextInputValue('note_avis');

            const noteInt = parseInt(noteRaw, 10);
            if (isNaN(noteInt) || noteInt < 0 || noteInt > 10)
                return interaction.reply({ content: '❌ La note doit être un nombre entre 0 et 10.', ephemeral: true });

            const mod = await interaction.guild.members.fetch(modId).catch(() => null);
            if (!mod)
                return interaction.reply({ content: '❌ Modérateur introuvable.', ephemeral: true });

            // Enregistrer en DB
            dbAddNote(evalUserId, mod.user.username, modId, noteInt, avis);

            // Log dans le salon de logs
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📝 Nouvelle évaluation')
                    .setColor(COLORS.MAIN)
                    .addFields(
                        { name: '👤 Utilisateur évalué', value: `<@${evalUserId}>`,    inline: false },
                        { name: '🛡️ Modérateur évalué',  value: `<@${modId}>`,         inline: false },
                        { name: '⭐ Note',                value: `${noteInt}/10`,       inline: false },
                        { name: '💬 Avis',                value: avis,                  inline: false },
                        { name: '🕐 Date',                value: new Date().toLocaleString('fr-FR'), inline: false }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.reply({ content: '✅ Votre avis a été enregistré avec succès !', ephemeral: true });

            // Supprimer le salon après 3 secondes
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 3000);
            return;
        }

        // ---- Modal : Candidature Staff ----
        if (interaction.customId === 'staff_modal') {
            const age   = interaction.fields.getTextInputValue('age');
            const motiv = interaction.fields.getTextInputValue('motiv');
            const exp   = interaction.fields.getTextInputValue('experience');
            const dispo = interaction.fields.getTextInputValue('dispo');

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel)
                return interaction.reply({ content: '❌ Erreur : Salon de logs non configuré.', ephemeral: true });

            const logEmbed = new EmbedBuilder()
                .setAuthor({ name: 'NOUVELLE CANDIDATURE REÇUE', iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`Dossier de ${interaction.user.username}`)
                .setColor(COLORS.INFO)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Identité',        value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
                    { name: '🎂 Âge',             value: `${age} ans`,  inline: true },
                    { name: '📅 Disponibilités',  value: dispo,          inline: true },
                    { name: '💡 Motivations',     value: motiv },
                    { name: '🛠️ Expérience',      value: exp }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
            return interaction.reply({ content: '✅ Votre candidature a été transmise ! La Direction reviendra vers vous si votre profil est retenu.', ephemeral: true });
        }

        // ---- Modal : Création Embed ----
        if (interaction.customId === 'embed_modal') {
            const t = interaction.fields.getTextInputValue('e_t');
            const d = interaction.fields.getTextInputValue('e_d');
            const c = interaction.fields.getTextInputValue('e_c') || COLORS.MAIN;
            const i = interaction.fields.getTextInputValue('e_i');

            const embed = new EmbedBuilder()
                .setTitle(t)
                .setDescription(`${BARRE}\n\n${d}\n\n${BARRE}`)
                .setColor(c.startsWith('#') ? c : COLORS.MAIN)
                .setTimestamp();

            if (i && i.startsWith('http')) embed.setImage(i);

            await interaction.channel.send({ embeds: [embed] });
            return interaction.reply({ content: '✅ Annonce publiée.', ephemeral: true });
        }

        // ---- Modal : MP (Diffusion) ----
        if (interaction.customId.startsWith('mp_modal')) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});

            const content = interaction.fields.getTextInputValue('msg_content');
            const isAll   = interaction.customId === 'mp_modal_all';

            const mpEmbed = new EmbedBuilder()
                .setAuthor({ name: 'COMMUNIQUÉ DU CAMPING RP', iconURL: interaction.guild.iconURL() })
                .setDescription(`${BARRE}\n\n${content}\n\n${BARRE}`)
                .setColor(COLORS.GOLD)
                .setTimestamp();

            if (isAll) {
                await interaction.editReply({ content: '🚀 Envoi lancé (5s d\'intervalle anti-ban)...' }).catch(() => {});
                const members = await interaction.guild.members.fetch().catch(() => new Collection());
                const list    = members.filter(m => !m.user.bot);
                let count = 0;

                for (const [, m] of list) {
                    try { await m.send({ embeds: [mpEmbed] }); count++; } catch (e) { /* MP fermés */ }
                    await new Promise(r => setTimeout(r, 5000));
                }
                return interaction.followUp({ content: `✅ Diffusion terminée. ${count}/${list.size} messages envoyés.`, ephemeral: true }).catch(() => {});
            } else {
                const targetId = interaction.customId.split('_')[3];
                try {
                    const user = await client.users.fetch(targetId);
                    await user.send({ embeds: [mpEmbed] });
                    return interaction.editReply({ content: '✅ Envoyé avec succès.' }).catch(() => {});
                } catch (e) {
                    return interaction.editReply({ content: '❌ Impossible d\'envoyer (ID invalide ou MP fermés).' }).catch(() => {});
                }
            }
        }
    }
});

// ============================================
// GESTION DES ERREURS
// ============================================

process.on('unhandledRejection', error => {
    console.error('❌ [CRITICAL ERROR] Erreur non gérée :', error);
});
client.on('error', console.error);

// ============================================
// LANCEMENT
// ============================================

client.login(TOKEN);
