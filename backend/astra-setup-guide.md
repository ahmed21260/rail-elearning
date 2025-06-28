# Guide pour trouver le Token Astra et le Keyspace

## 1. Accéder à votre projet Astra

1. Allez sur [https://astra.datastax.com](https://astra.datastax.com)
2. Connectez-vous à votre compte
3. Cliquez sur votre projet : **proj_o4XM4GnzWKr2hm0VHjHB8SYv**

## 2. Trouver le Keyspace

1. Dans le menu de gauche, cliquez sur **"Database"**
2. Cliquez sur votre base de données : **dc3c8e6d-e14a-4b0b-bb44-a5d2f026b7a9**
3. Dans l'onglet **"Keyspaces"**, vous verrez le nom de votre keyspace (ex: `default_keyspace` ou un nom personnalisé)
4. **Notez ce nom** - c'est votre `ASTRA_DB_KEYSPACE`

## 3. Générer le Token d'Application

1. Dans le menu de gauche, cliquez sur **"Settings"** (icône engrenage)
2. Cliquez sur **"Database Administrator"**
3. Cliquez sur **"Generate Token"**
4. Donnez un nom à votre token (ex: "rail-elearning-api")
5. Sélectionnez les permissions :
   - **Full Access** (pour le développement)
   - Ou **Custom** avec les permissions spécifiques
6. Cliquez sur **"Generate Token"**
7. **⚠️ IMPORTANT : Copiez immédiatement le token** - vous ne pourrez plus le voir après !
8. **Notez ce token** - c'est votre `ASTRA_DB_APPLICATION_TOKEN`

## 4. Trouver la Région

1. Dans **"Database"** > votre base de données
2. Regardez l'URL ou les informations de connexion
3. La région est généralement dans l'URL (ex: `eu-west-1`, `us-east1`, etc.)
4. **Notez cette région** - c'est votre `ASTRA_DB_REGION`

## 5. Configuration complète

Une fois que vous avez ces informations, créez un fichier `.env` dans le dossier `backend/` :

```env
ASTRA_DB_ID=dc3c8e6d-e14a-4b0b-bb44-a5d2f026b7a9
ASTRA_DB_REGION=eu-west-1
ASTRA_DB_KEYSPACE=votre_keyspace_ici
ASTRA_DB_APPLICATION_TOKEN=votre_token_ici
```

## 6. Test de connexion

Après avoir configuré les variables, vous pouvez tester la connexion avec le script de test fourni.

## 7. Sécurité

- **Ne partagez jamais votre token**
- **Ne committez jamais le fichier .env dans Git**
- **Utilisez des variables d'environnement sur votre plateforme de déploiement**

## 8. Support

Si vous ne trouvez pas ces informations :
1. Vérifiez que vous êtes bien connecté à votre compte Astra
2. Vérifiez que vous avez les droits d'administrateur sur le projet
3. Consultez la documentation officielle : [https://docs.datastax.com/en/astra/docs/](https://docs.datastax.com/en/astra/docs/) 