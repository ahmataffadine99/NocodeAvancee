# Architecture de départ

## Services locaux

| Service | Image | Adresse locale | Persistance |
| --- | --- | --- | --- |
| Baserow | `baserow/baserow:2.4.1` | `http://localhost:8081` | Volume Docker `baserow_data` |
| n8n | `docker.n8n.io/n8nio/n8n:2.45.6` | `http://localhost:5678` | Volume Docker `n8n_data` |

Les deux ports sont liés à `127.0.0.1`. Baserow utilise son image tout-en-un
officielle pour ce prototype local. n8n utilise son stockage SQLite intégré et
son volume persistant ; cela évite d'ajouter un service de base de données avant
que le besoin du projet ne le justifie.

Les appels d'n8n vers Baserow utiliseront l'adresse interne Docker
`http://baserow:80`, et non `localhost` (qui désigne le conteneur n8n lui-même).

## Modèle Baserow à créer

Les six tables requises par le sujet :

1. `Collaborators`
2. `Technicians`
3. `Tickets`
4. `Replies`
5. `KnowledgeBase`
6. `AuditLog`

Les champs, relations et règles détaillés seront définis avant la création du
schéma et documentés ici. Ne place aucune donnée réelle de collaborateurs dans
le jeu de démonstration.

## Workflows prévus

- `W1` : réception, normalisation, classification structurée et affectation.
- `W2` : recherche documentaire, brouillon de réponse et approbation humaine.
- `W3` : surveillance SLA, notifications et journalisation.
- `W4` : rapport hebdomadaire.
- `W5` : assistant de base de connaissances (bonus).

Un workflow réutilisable sera invoqué par au moins deux workflows parents et
retournera une sortie documentée et normalisée.
