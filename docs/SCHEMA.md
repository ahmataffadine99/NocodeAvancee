# Schéma Baserow

Créer ces six tables dans la base `HelpDesk IA`. Les noms de tables, champs,
workflows et variables restent en anglais, conformément au sujet. Les données
de démonstration devront être fictives.

## Tables et champs

### `Collaborators`

| Champ | Type Baserow | Règle |
| --- | --- | --- |
| `name` | Texte | Nom complet |
| `first_name` | Texte | Prénom |
| `email` | E-mail | Identifiant du demandeur |
| `team` | Texte | Équipe |
| `site` | Texte | Site |
| `role` | Texte | Rôle |

### `Technicians`

| Champ | Type Baserow | Règle |
| --- | --- | --- |
| `name` | Texte | Nom complet |
| `email` | E-mail | Adresse de notification |
| `skills` | Sélection multiple | `hardware`, `access`, `software`, `network`, `onboarding`, `other` |
| `open_tickets` | Nombre | Initialiser à `0` |
| `available` | Booléen | Initialiser à vrai |

### `Tickets`

| Champ | Type Baserow | Règle |
| --- | --- | --- |
| `reference` | Texte | Référence générée par W1 |
| `subject` | Texte | Sujet de la demande |
| `description` | Texte long | Description normalisée |
| `category` | Sélection simple | `hardware`, `access`, `software`, `network`, `onboarding`, `other` |
| `priority` | Sélection simple | `P1`, `P2`, `P3`, `P4` |
| `status` | Sélection simple | `new`, `triaged`, `assigned`, `pending`, `waiting_approval`, `closed`, `manual_review` |
| `requester` | Lien vers `Collaborators` | Un demandeur par ticket |
| `assignee` | Lien vers `Technicians` | Peut être vide si aucune affectation sûre |
| `created_at` | Date et heure | Horodatage normalisé par W1 |
| `sla_due_at` | Date et heure | Échéance calculée selon la priorité |
| `tags` | Sélection multiple | Inclure `manual_review` pour les cas à vérifier |
| `ai_confidence` | Nombre décimal | Score entre `0` et `1` |

### `Replies`

| Champ | Type Baserow | Règle |
| --- | --- | --- |
| `ticket` | Lien vers `Tickets` | Ticket concerné |
| `body` | Texte long | Brouillon ou réponse approuvée |
| `status` | Sélection simple | `draft`, `approved`, `rejected`, `sent` |
| `created_at` | Date et heure | Création du brouillon |
| `validated_by` | Lien vers `Collaborators` | Personne ayant approuvé ou rejeté |

### `KnowledgeBase`

| Champ | Type Baserow | Règle |
| --- | --- | --- |
| `title` | Texte | Titre de l’article |
| `category` | Sélection simple | Mêmes catégories que `Tickets` |
| `content` | Texte long | Contenu utilisé pour la recherche |
| `source` | Texte | Référence ou URL interne |
| `tags` | Sélection multiple | Termes utiles à la recherche |
| `updated_at` | Date et heure | Dernière mise à jour |
| `is_active` | Booléen | Seuls les articles actifs servent à W2 |

### `AuditLog`

| Champ | Type Baserow | Règle |
| --- | --- | --- |
| `timestamp` | Date et heure | Date de l’événement |
| `ticket` | Lien vers `Tickets` | Peut être vide pour une erreur avant création du ticket |
| `action` | Sélection simple | `triaged`, `reply_drafted`, `reply_sent`, `ai_error`, `sla_reminder`, `report_generated` |
| `details` | Texte long | Résumé structuré de la décision, sans secret |
| `outcome` | Texte | Résultat ou erreur explicite |

## Relations et règles métier

- `Tickets.requester` est lié à `Collaborators`.
- `Tickets.assignee` est lié à `Technicians`.
- `Replies.ticket` et `AuditLog.ticket` sont liés à `Tickets`.
- `Replies.validated_by` est lié à `Collaborators`.
- L’affectation exige un technicien disponible dont `skills` comprend la
  catégorie du ticket. Ne pas affecter automatiquement un technicien non
  qualifié.
- Une confiance IA inférieure à `0.6`, une erreur de parsing ou une erreur API
  entraîne `category=other`, `priority=P3`, le tag `manual_review` et aucune
  réponse automatique.
- Un brouillon de réponse n’est jamais envoyé avant approbation humaine.
- Chaque décision et erreur importante est journalisée dans `AuditLog`.
