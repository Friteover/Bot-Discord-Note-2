import discord
from discord.ext import commands, tasks
from discord import app_commands
import sqlite3
from datetime import datetime
from typing import Optional
import asyncio

# ============================================
# CONFIGURATION
# ============================================

TOKEN = "YOUR_DISCORD_TOKEN_HERE"
MOD_ROLE_ID = 1234567890  # À remplacer par ton ID de rôle MOD
CATEGORY_ID = 1234567890  # À remplacer par l'ID de ta catégorie
LOGS_CHANNEL_ID = 1234567890  # À remplacer par l'ID du salon logs

# ============================================
# SETUP BOT
# ============================================

intents = discord.Intents.default()
intents.message_content = True
intents.members = True
bot = commands.Bot(command_prefix="!", intents=intents)

# ============================================
# DATABASE SETUP
# ============================================

def init_db():
    conn = sqlite3.connect('moderator_notes.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            mod_name TEXT,
            mod_id INTEGER,
            note INTEGER,
            avis TEXT,
            date TEXT
        )
    ''')
    conn.commit()
    conn.close()

def add_note(user_id: int, mod_name: str, mod_id: int, note: int, avis: str):
    conn = sqlite3.connect('moderator_notes.db')
    cursor = conn.cursor()
    date = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    cursor.execute('''
        INSERT INTO notes (user_id, mod_name, mod_id, note, avis, date)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, mod_name, mod_id, note, avis, date))
    conn.commit()
    conn.close()

def get_mod_average(mod_id: int) -> tuple[float, int]:
    conn = sqlite3.connect('moderator_notes.db')
    cursor = conn.cursor()
    cursor.execute('SELECT note FROM notes WHERE mod_id = ?', (mod_id,))
    notes = cursor.fetchall()
    conn.close()
    
    if not notes:
        return 0.0, 0
    avg = sum(n[0] for n in notes) / len(notes)
    return round(avg, 2), len(notes)

def get_top_mods(guild: discord.Guild) -> list[tuple[str, float, int]]:
    conn = sqlite3.connect('moderator_notes.db')
    cursor = conn.cursor()
    cursor.execute('SELECT mod_name, mod_id, AVG(note) as avg, COUNT(*) as count FROM notes GROUP BY mod_id ORDER BY avg DESC LIMIT 10')
    results = cursor.fetchall()
    conn.close()
    return results

def get_user_avis(user_id: int) -> list[tuple[str, str, int, str]]:
    conn = sqlite3.connect('moderator_notes.db')
    cursor = conn.cursor()
    cursor.execute('SELECT mod_name, avis, note, date FROM notes WHERE user_id = ? ORDER BY date DESC', (user_id,))
    results = cursor.fetchall()
    conn.close()
    return results

# ============================================
# BOT EVENTS
# ============================================

@bot.event
async def on_ready():
    print(f"✅ Bot connecté en tant que {bot.user}")
    await bot.tree.sync()
    print("✅ Slash commands synchronisés")

# ============================================
# SLASH COMMANDS
# ============================================

@bot.tree.command(name="note", description="Créer un ticket d'évaluation pour un utilisateur")
@app_commands.describe(utilisateur="L'utilisateur à évaluer")
async def note_command(interaction: discord.Interaction, utilisateur: discord.User):
    # Vérifier que l'utilisateur est modérateur
    mod_role = interaction.guild.get_role(MOD_ROLE_ID)
    if mod_role not in interaction.user.roles and interaction.user != interaction.guild.owner:
        await interaction.response.send_message("❌ Vous n'avez pas la permission d'utiliser cette commande.", ephemeral=True)
        return
    
    # Vérifier qu'un salon n'existe pas déjà
    existing_channel = discord.utils.get(interaction.guild.channels, name=f"note-{utilisateur.name.lower()}")
    if existing_channel:
        await interaction.response.send_message(f"❌ Un salon d'évaluation existe déjà pour {utilisateur.mention}", ephemeral=True)
        return
    
    # Créer le salon privé
    category = interaction.guild.get_channel(CATEGORY_ID)
    if not category:
        await interaction.response.send_message("❌ Catégorie non trouvée.", ephemeral=True)
        return
    
    overwrites = {
        interaction.guild.default_role: discord.PermissionOverwrite(view_channel=False),
        utilisateur: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
        interaction.user: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
        interaction.guild.owner: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
    }
    
    channel = await interaction.guild.create_text_channel(
        name=f"note-{utilisateur.name.lower()}",
        category=category,
        overwrites=overwrites
    )
    
    # Envoyer l'embed avec le bouton
    embed = discord.Embed(
        title=f"Évaluation de {utilisateur.mention}",
        description="Cliquez sur le bouton ci-dessous pour donner votre avis.",
        color=discord.Color.blue()
    )
    embed.set_thumbnail(url=utilisateur.avatar.url)
    
    await channel.send(embed=embed, view=NoteButtonView(utilisateur, interaction.guild))
    
    await interaction.response.send_message(f"✅ Salon de note créé : {channel.mention}", ephemeral=True)

@bot.tree.command(name="moyenne", description="Afficher la moyenne des notes d'un modérateur")
@app_commands.describe(mod_name="Le nom du modérateur")
async def moyenne_command(interaction: discord.Interaction, mod_name: str):
    # Chercher le modérateur
    mod = discord.utils.get(interaction.guild.members, name=mod_name)
    if not mod:
        await interaction.response.send_message("❌ Modérateur non trouvé.", ephemeral=True)
        return
    
    avg, count = get_mod_average(mod.id)
    
    if count == 0:
        await interaction.response.send_message(f"📊 **{mod.name}** n'a pas encore reçu d'évaluation.", ephemeral=True)
        return
    
    embed = discord.Embed(
        title=f"Statistiques de {mod.name}",
        description=f"⭐ **Moyenne** : {avg}/10\n📝 **Nombre d'évaluations** : {count}",
        color=discord.Color.gold()
    )
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="topmods", description="Afficher le classement des meilleurs modérateurs")
async def topmods_command(interaction: discord.Interaction):
    results = get_top_mods(interaction.guild)
    
    if not results:
        await interaction.response.send_message("📊 Aucune évaluation enregistrée.", ephemeral=True)
        return
    
    description = ""
    for i, (mod_name, mod_id, avg, count) in enumerate(results, 1):
        description += f"{i}. **{mod_name}** - ⭐ {avg}/10 ({count} évals)\n"
    
    embed = discord.Embed(
        title="🏆 Top 10 Modérateurs",
        description=description,
        color=discord.Color.gold()
    )
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="avis", description="Afficher l'historique des avis donnés")
@app_commands.describe(utilisateur="L'utilisateur")
async def avis_command(interaction: discord.Interaction, utilisateur: discord.User):
    avis_list = get_user_avis(utilisateur.id)
    
    if not avis_list:
        await interaction.response.send_message(f"📝 Aucun avis trouvé pour {utilisateur.mention}", ephemeral=True)
        return
    
    embed = discord.Embed(
        title=f"Historique des avis - {utilisateur.name}",
        color=discord.Color.blue()
    )
    
    for mod_name, avis, note, date in avis_list:
        embed.add_field(
            name=f"{mod_name} - ⭐ {note}/10",
            value=f"{avis}\n*{date}*",
            inline=False
        )
    
    await interaction.response.send_message(embed=embed, ephemeral=True)

# ============================================
# UI VIEWS & MODALS
# ============================================

class NoteButtonView(discord.ui.View):
    def __init__(self, utilisateur: discord.User, guild: discord.Guild):
        super().__init__()
        self.utilisateur = utilisateur
        self.guild = guild
    
    @discord.ui.button(label="Donner mon avis", style=discord.ButtonStyle.blue)
    async def opinion_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        # Récupérer les modérateurs
        mod_role = interaction.guild.get_role(MOD_ROLE_ID)
        if not mod_role:
            await interaction.response.send_message("❌ Rôle modérateur non trouvé.", ephemeral=True)
            return
        
        mods = [member for member in interaction.guild.members if mod_role in member.roles]
        
        if not mods:
            await interaction.response.send_message("❌ Aucun modérateur trouvé.", ephemeral=True)
            return
        
        # Créer le select menu
        view = ModeratorSelectView(mods, self.utilisateur, self.guild)
        select_menu = discord.ui.Select(
            placeholder="Sélectionnez un modérateur",
            options=[
                discord.SelectOption(label=mod.name, value=str(mod.id))
                for mod in mods[:25]  # Discord limite à 25 options
            ],
            custom_id="mod_select"
        )
        
        async def select_callback(select_interaction: discord.Interaction):
            selected_mod_id = int(select_menu.values[0])
            selected_mod = interaction.guild.get_member(selected_mod_id)
            await select_interaction.response.send_modal(NoteModal(selected_mod, self.utilisateur))
        
        select_menu.callback = select_callback
        view.add_item(select_menu)
        
        await interaction.response.send_message("📋 Sélectionnez un modérateur :", view=view, ephemeral=True)

class ModeratorSelectView(discord.ui.View):
    def __init__(self, mods: list, utilisateur: discord.User, guild: discord.Guild):
        super().__init__()
        self.mods = mods
        self.utilisateur = utilisateur
        self.guild = guild

class NoteModal(discord.ui.Modal, title="Évaluation du modérateur"):
    note_input = discord.ui.TextInput(
        label="Note (0-10)",
        placeholder="Entrez une note entre 0 et 10",
        required=True,
        min_length=1,
        max_length=2
    )
    
    avis_input = discord.ui.TextInput(
        label="Votre avis",
        placeholder="Donnez votre avis détaillé",
        style=discord.TextStyle.long,
        required=True,
        min_length=10,
        max_length=2000
    )
    
    def __init__(self, mod: discord.Member, utilisateur: discord.User):
        super().__init__()
        self.mod = mod
        self.utilisateur = utilisateur
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            note = int(self.note_input.value)
        except ValueError:
            await interaction.response.send_message("❌ La note doit être un nombre.", ephemeral=True)
            return
        
        if not 0 <= note <= 10:
            await interaction.response.send_message("❌ La note doit être entre 0 et 10.", ephemeral=True)
            return
        
        avis = self.avis_input.value
        
        # Ajouter à la base de données
        add_note(self.utilisateur.id, self.mod.name, self.mod.id, note, avis)
        
        # Envoyer les logs
        logs_channel = interaction.guild.get_channel(LOGS_CHANNEL_ID)
        if logs_channel:
            embed = discord.Embed(
                title="📝 Nouvelle évaluation",
                color=discord.Color.green()
            )
            embed.add_field(name="Utilisateur évalué", value=self.utilisateur.mention, inline=False)
            embed.add_field(name="Modérateur évalué", value=self.mod.mention, inline=False)
            embed.add_field(name="Note", value=f"⭐ {note}/10", inline=False)
            embed.add_field(name="Avis", value=avis, inline=False)
            embed.add_field(name="Date", value=datetime.now().strftime("%d/%m/%Y %H:%M:%S"), inline=False)
            
            await logs_channel.send(embed=embed)
        
        await interaction.response.send_message("✅ Votre avis a été enregistré !", ephemeral=True)
        
        # Supprimer le salon après 2 secondes
        await asyncio.sleep(2)
        await interaction.channel.delete()

# ============================================
# RUN BOT
# ============================================

if __name__ == "__main__":
    init_db()
    bot.run(TOKEN)
