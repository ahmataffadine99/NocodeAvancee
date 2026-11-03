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
Les requêtes API faites depuis n8n ajoutent l'en-tête `Host: localhost:8081` :
Baserow utilise cette adresse publique canonique et traite sinon le nom Docker
comme un domaine d'application publiée.

## Modèle Baserow à créer

Les six tables requises par le sujet :

1. `Collaborators`
2. `Technicians`
3. `Tickets`
4. `Replies`
5. `KnowledgeBase`
6. `AuditLog`

Les champs, relations et règles détaillés sont définis dans
[SCHEMA.md](SCHEMA.md). Ne place aucune donnée réelle de collaborateurs dans le
jeu de démonstration.
Le jeu fictif rejouable demandé par le sujet se trouve dans
[seed/seed-baserow.mjs](../seed/seed-baserow.mjs) ; il ne supprime aucune ligne.

## Workflows

- `W1` (`W1-ticket-intake.json`) : formulaire, normalisation, classification
  structurée, affectation, mails. Lance W2 sans l'attendre.
- `W2` : recherche documentaire, brouillon de réponse et approbation humaine.
- `W3` : surveillance SLA (toutes les heures), mails et statut `late`.
- `W4` : rapport hebdomadaire (vendredi 17h) par mail et dans `AuditLog`.
- `W5` : assistant de base de connaissances (bonus), webhook
  `POST /webhook/kb-assistant` avec `{"question": "..."}`; réponse JSON avec
  `answer` et `sources` (articles cités).
- `SUB - Write Audit Log` : sous-workflow réutilisé par W2, W3, W4 et le
  workflow d'erreur ; il écrit une ligne dans `AuditLog`.
- `ERR - Global Error Handler` : workflow d'erreur global (Error Trigger),
  rattaché à tous les workflows ; il journalise dans `AuditLog` et alerte
  `ERROR_EMAIL`.

## Robustesse

- Appels HTTP, Gemini et SMTP : 3 essais avec attente fixe entre les essais
  (2 s pour HTTP/SMTP, 5 s pour l'IA), y compris sur 429.
- IA : `onError: continueRegularOutput` puis branche de repli (W1 : revue
  manuelle ; W2 : pas de brouillon ; W4 : rapport sans résumé ; W5 : message
  « aucune réponse fiable »).
- Idempotence : W1 refuse les doublons ; W3 ne relance plus un ticket déjà
  `late`.
- Aucun secret dans les workflows : credentials n8n et variables d'environnement.
