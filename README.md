# HelpDesk IA — NoCode avancé

Projet pédagogique de back-office HelpDesk assisté par IA, réalisé avec n8n et
Baserow auto-hébergés.

## Prérequis

- Docker Desktop démarré avec Docker Compose v2.
- Git.
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
Les futurs secrets d'API seront ajoutés aux identifiants sécurisés de n8n, pas
aux exports de workflows ni au dépôt Git.

Les paramètres modifiables sont documentés dans `.env.example`. Pour les
personnaliser, copie-le en `.env` ; ce dernier est ignoré par Git.

## Prochaines étapes

1. Vérifier que les deux interfaces locales s'ouvrent.
2. Créer les six tables Baserow décrites dans
   [docs/SCHEMA.md](docs/SCHEMA.md), puis ajouter des données fictives de
   démonstration.
3. Construire et tester le workflow W1, puis W2, W3 et W4.
4. Exporter les workflows dans `workflows/` et compléter la documentation.

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le schéma de départ.
