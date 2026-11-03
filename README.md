# HelpDesk IA — NoCode avancé

Projet pédagogique de back-office HelpDesk assisté par IA, réalisé avec n8n et
Baserow auto-hébergés.

## Prérequis

- Docker Desktop démarré avec Docker Compose v2.
- Git.
- Node.js 18 ou plus (script de seed Baserow).
- Un navigateur web.

Les services utilisent des images officielles épinglées à une version et des
volumes Docker persistants. Les ports sont liés à `127.0.0.1` : ils ne sont
accessibles que depuis cet ordinateur.

## Démarrage local

Dans un terminal ouvert à la racine du projet :

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
rejouable. Les lignes créées par [seed/seed-baserow.mjs](seed/seed-baserow.mjs)
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

## Prochaines étapes

1. Vérifier que les deux interfaces locales s'ouvrent.
2. Créer les six tables Baserow décrites dans
   [docs/SCHEMA.md](docs/SCHEMA.md), puis exécuter le script de seed ci-dessus.
3. Construire et tester le workflow W1, puis W2, W3 et W4.
4. Exporter les workflows dans `workflows/` et compléter la documentation.

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le schéma de départ.
