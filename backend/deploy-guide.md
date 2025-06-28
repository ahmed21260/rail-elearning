# Guide de Déploiement Backend Astra

## 🚀 Déploiement sur Railway

### 1. Préparation
1. Créez un compte sur [Railway](https://railway.app)
2. Connectez votre repository GitHub
3. Sélectionnez le dossier `backend/` de votre projet

### 2. Configuration des variables d'environnement
Dans le dashboard Railway, ajoutez ces variables :
```env
ASTRA_DB_ID=dc3c8e6d-e14a-4b0b-bb44-a5d2f026b7a9
ASTRA_DB_REGION=eu-west-1
ASTRA_DB_KEYSPACE=votre_keyspace
ASTRA_DB_APPLICATION_TOKEN=votre_token
FRONTEND_URL=https://votre-frontend.vercel.app
NODE_ENV=production
```

### 3. Déploiement
- Railway détecte automatiquement le `package.json`
- Le `Procfile` indique `web: node api.js`
- Déploiement automatique à chaque push

---

## 🚀 Déploiement sur Render

### 1. Préparation
1. Créez un compte sur [Render](https://render.com)
2. Connectez votre repository GitHub
3. Créez un nouveau "Web Service"

### 2. Configuration
- **Build Command**: `npm install`
- **Start Command**: `node api.js`
- **Root Directory**: `backend/`

### 3. Variables d'environnement
Ajoutez les mêmes variables que pour Railway.

---

## 🚀 Déploiement sur Heroku

### 1. Préparation
1. Installez Heroku CLI
2. Créez une app Heroku

### 2. Configuration
```bash
cd backend
heroku create votre-app-name
heroku config:set ASTRA_DB_ID=dc3c8e6d-e14a-4b0b-bb44-a5d2f026b7a9
heroku config:set ASTRA_DB_REGION=eu-west-1
heroku config:set ASTRA_DB_KEYSPACE=votre_keyspace
heroku config:set ASTRA_DB_APPLICATION_TOKEN=votre_token
heroku config:set FRONTEND_URL=https://votre-frontend.vercel.app
```

### 3. Déploiement
```bash
git add .
git commit -m "Deploy backend"
git push heroku main
```

---

## 🔧 Configuration Frontend

### 1. Variables d'environnement
Dans votre frontend, créez un fichier `.env.local` :
```env
REACT_APP_API_URL=https://votre-backend.railway.app
```

### 2. Mise à jour de l'API client
L'API client (`frontend/src/api/astraApi.ts`) utilise automatiquement cette URL.

---

## 🧪 Tests de déploiement

### 1. Test de santé
```bash
curl https://votre-backend.railway.app/health
```

### 2. Test des cours
```bash
curl https://votre-backend.railway.app/api/courses
```

### 3. Test de création
```bash
curl -X POST https://votre-backend.railway.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Cours",
    "description": "Description test",
    "instructor": "Test Instructor",
    "category": "Test",
    "level": "débutant",
    "duration": 60,
    "thumbnail": "https://example.com/test.jpg",
    "is_required": false,
    "rating": 0,
    "enrolled_count": 0
  }'
```

---

## 📊 Monitoring

### 1. Logs
- **Railway**: Dashboard > Logs
- **Render**: Dashboard > Logs
- **Heroku**: `heroku logs --tail`

### 2. Métriques
- Surveillez les requêtes/min
- Vérifiez les temps de réponse
- Contrôlez l'utilisation mémoire

---

## 🔒 Sécurité

### 1. Rate Limiting
L'API inclut déjà un rate limiting (100 req/15min par IP).

### 2. CORS
Configuré pour accepter uniquement votre frontend.

### 3. Helmet
Headers de sécurité automatiques.

---

## 🚨 Dépannage

### Erreur de connexion Astra
1. Vérifiez le token
2. Vérifiez la région
3. Vérifiez le keyspace
4. Testez avec le script de test

### Erreur CORS
1. Vérifiez `FRONTEND_URL`
2. Ajoutez votre domaine dans les origines autorisées

### Erreur de port
1. Vérifiez que le port est bien `process.env.PORT`
2. Railway/Render/Heroku définissent automatiquement cette variable

---

## 📝 Checklist de déploiement

- [ ] Variables d'environnement configurées
- [ ] Tests de connexion Astra réussis
- [ ] Tables Astra créées (`npm run init-tables`)
- [ ] Frontend configuré avec la bonne URL API
- [ ] Tests de santé positifs
- [ ] Tests CRUD fonctionnels
- [ ] Monitoring configuré
- [ ] Logs surveillés

---

## 🔗 Liens utiles

- [Documentation Railway](https://docs.railway.app)
- [Documentation Render](https://render.com/docs)
- [Documentation Heroku](https://devcenter.heroku.com)
- [Documentation Astra](https://docs.datastax.com/en/astra/docs/) 