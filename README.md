# HelpDesk IA — NoCode avancé

Projet pédagogique de back-office HelpDesk assisté par IA, réalisé avec n8n et
Baserow auto-hébergés.

## Fonctionnalités

- **W1 — Ticket Intake** : formulaire n8n, normalisation, recherche du demandeur,
  classification IA (JSON Schema strict, seuil de confiance), anti-doublon,
  affectation par compétence et charge, écriture Baserow, mails au demandeur et au
  technicien, alerte immédiate P1, audit `triaged` / `ai_error`.
- **W2 — Assisted Reply** : recherche dans la base de connaissances, brouillon IA
  limité aux articles trouvés, validation humaine obligatoire (approbation ou
  rejet), envoi uniquement après approbation, audit `reply_drafted` / `reply_sent`.
- **W3 — SLA Reminders** (toutes les heures) : tickets en retard ou proches de
  l'échéance, mail au technicien, statut `late`, audit `sla_reminder`.
- **W4 — Weekly Report** (vendredi 17h) : agrégation par catégorie, priorité et
  technicien, résumé IA + chiffres clés, mail et audit `report_generated`.
- **W5 — KB Assistant** (bonus) : webhook `POST /webhook/kb-assistant` qui répond
  en citant les articles utilisés.
- **SUB - Write Audit Log** : sous-workflow aux entrées typées, réutilisé par W2,
  W3, W4 et le workflow d'erreur.
- **ERR - Global Error Handler** : workflow d'erreur global (journal + alerte mail).
- Repli si l'IA est indisponible : catégorie `other`, priorité `P3`, tag
  `manual_review`, journal `ai_error`.

## Prérequis

- Docker Desktop démarré avec Docker Compose v2.
- Git.
- Node.js 18 ou plus (script de seed Baserow).
- Un navigateur web.

Les services utilisent des images officielles épinglées à une version et des
volumes Docker persistants. Les ports sont liés à `127.0.0.1` : ils ne sont
accessibles que depuis cet ordinateur.

## Démarrage local

Dans un terminal ouvert à la racine du projet, démarrage en une commande
(crée `.env` si besoin, lance les services et attend qu'ils répondent) :

```powershell
.\start.ps1
```

Équivalent manuel :

```powershell
docker compose config
docker compose up -d
docker compose ps
```

Au premier démarrage, Docker télécharge les images ; cela peut prendre quelques
minutes. Ouvre ensuite :

- Baserow : <http://localhost:8081>
- n8n : <http://localhost:5678>
- Mailpit (boîte de réception locale des e-mails envoyés par n8n) : <http://localhost:8025>

Dans n8n, les e-mails passent par un credential SMTP : hôte `mailpit`, port `1025`,
sans authentification ni SSL. Aucun e-mail ne quitte la machine.

Connecte-toi avec le compte créé dans chaque application.
Les données sont conservées dans les volumes Docker `baserow_data` et
`n8n_data`, même après l'arrêt des conteneurs.

Pour consulter les journaux :

```powershell
docker compose logs -f baserow
docker compose logs -f n8n
```

Pour arrêter les services sans supprimer les données :

```powershell
docker compose down
```

Ne lance pas `docker compose down -v` sauf si tu veux supprimer définitivement
les données locales.

## Sécurité et configuration

La configuration par défaut est destinée au développement local, pas à une
exposition sur Internet. Ne partage pas les mots de passe, clés API ou jetons.
Les secrets des workflows restent dans les identifiants sécurisés de n8n. Le
jeton utilisé par le script de seed peut être stocké dans le `.env` local ignoré
par Git ; aucun secret ne doit apparaître dans les exports de workflows ou dans
le dépôt.

Les paramètres modifiables sont documentés dans `.env.example`. Pour les
personnaliser, copie-le en `.env` ; ce dernier est ignoré par Git.

## Jeu de données de démonstration

Le sujet demande un jeu de données et un script d'initialisation Baserow
rejouable. Les six tables doivent d'abord exister dans Baserow (champs et
relations décrits dans [docs/SCHEMA.md](docs/SCHEMA.md)) ; renseigner leurs
identifiants dans `.env` (`BASEROW_TABLE_*_ID`). Les lignes créées par [seed/seed-baserow.mjs](seed/seed-baserow.mjs)
sont fictives et couvrent les six tables. Le script crée ou met à jour les
lignes de démonstration à partir de leur adresse e-mail, référence ou titre ; il
ne supprime aucune ligne.

1. Dans Baserow, ouvre le menu du compte, puis **Mon compte → Jetons d'accès à
   la base → Créer un jeton** si le jeton existant n'est plus disponible.
2. Autorise seulement les permissions nécessaires, sans permission de
   suppression : création et lecture sur les six tables ; modification sur
   `Technicians`, `Tickets` et `Replies` pour les workflows qui les mettent à
   jour.
3. Copie le jeton directement dans le fichier local `.env`, à la ligne
   `BASEROW_API_TOKEN=`, puis vérifie les identifiants de tables dans ce fichier.
   Ne partage pas ce fichier et ne le committe pas.
4. Depuis la racine du dépôt, exécute :

   ```powershell
   node seed\seed-baserow.mjs
   ```

Le jeu inclut un ticket assigné, un ticket au SLA dépassé, un ticket sans
technicien correspondant, des brouillons/réponses approuvées, des articles de
connaissance et des événements d'audit. Relancer la commande ne crée pas de
doublons sur ces lignes de démonstration.

## Importer les workflows dans n8n

Les workflows exportés sont dans [workflows/](workflows). Avant de les importer
(`n8n import:workflow` ou menu **Import from file**), crée dans n8n trois
credentials, car aucun secret n'est versionné :

- **Baserow Header Auth** (Header Auth) : nom `Authorization`, valeur
  `Token <jeton Baserow>` ;
- **Mailpit SMTP** (SMTP) : hôte `mailpit`, port `1025`, sans authentification
  ni SSL ;
- **Google Gemini(PaLM) Api account** : ta clé Gemini.

Importe aussi `SUB-write-audit-log.json`, `W2-assisted-reply.json`,
`W3-sla-reminders.json`, `W4-weekly-report.json`,
`W5-kb-assistant.json`, `ERR-error-handler.json` puis
`W1-ticket-intake.json` (dans cet ordre) ; le sous-workflow d'audit et le
workflow d'erreur doivent être publiés (W5 aussi pour son webhook de
production).

n8n lit les identifiants de tables, les délais SLA, le seuil de confiance et
l'expéditeur dans les variables d'environnement définies par
`docker-compose.yml` (valeurs modifiables dans `.env`). Depuis le conteneur
n8n, Baserow est joignable sur `http://baserow:80` grâce à
`BASEROW_EXTRA_PUBLIC_URLS`.

Le formulaire de W1 est servi par n8n sur `/form/<id>` une fois le workflow
publié (`/form-test/<id>` pendant un test manuel).

## Tester le résultat attendu

1. Publier W1, W2, W5, `SUB - Write Audit Log` et `ERR - Global Error Handler`
   (W3 et W4 se déclenchent seuls une fois publiés, ou via « Execute workflow »).
2. Ouvrir le formulaire `http://localhost:5678/form/<id>` (id affiché dans le
   nœud `Receive Ticket Form`), soumettre une demande.
3. Dans Baserow : nouveau ticket (catégorie, priorité, technicien), ligne
   `triaged` dans `AuditLog`. Dans Mailpit : accusé de réception et mail au
   technicien (et alerte P1 si priorité P1).
4. Si un article correspond : le mail « Reply draft to approve » contient un
   lien ; approuver envoie la réponse au demandeur, rejeter n'envoie rien.
5. Webhook W5 : `POST http://localhost:5678/webhook/kb-assistant` avec
   `{"question": "..."}`.

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour l'architecture et les
choix, [docs/PROMPTS.md](docs/PROMPTS.md) pour les prompts et
[docs/SCHEMA.md](docs/SCHEMA.md) pour le modèle de données.
