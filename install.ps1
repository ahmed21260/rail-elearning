# Script d'installation PowerShell pour Rail E-Learning
# Ce script configure automatiquement l'environnement de développement sur Windows

param(
    [switch]$SkipDependencies,
    [switch]$SkipFirebase,
    [switch]$Force
)

# Configuration des couleurs pour PowerShell
$Host.UI.RawUI.ForegroundColor = "White"

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

Write-Host "🚀 Installation de Rail E-Learning..." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier PowerShell version
Write-Status "Vérification de PowerShell..."
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Error "PowerShell 5.0 ou supérieur est requis"
    exit 1
}
Write-Success "PowerShell $($PSVersionTable.PSVersion) détecté"

# Vérifier Node.js
Write-Status "Vérification de Node.js..."
try {
    $nodeVersion = node --version
    Write-Success "Node.js $nodeVersion détecté"
} catch {
    Write-Error "Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/"
    exit 1
}

# Vérifier npm
Write-Status "Vérification de npm..."
try {
    $npmVersion = npm --version
    Write-Success "npm $npmVersion détecté"
} catch {
    Write-Error "npm n'est pas installé."
    exit 1
}

# Vérifier Git
Write-Status "Vérification de Git..."
try {
    $gitVersion = git --version
    Write-Success "$gitVersion détecté"
} catch {
    Write-Warning "Git n'est pas installé. L'installation continuera sans Git."
}

# Créer le fichier .env s'il n'existe pas
Write-Status "Configuration des variables d'environnement..."
$envPath = "frontend\.env"
if (-not (Test-Path $envPath)) {
    $envContent = @"
# Configuration Firebase
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef123456
REACT_APP_FIREBASE_VAPID_KEY=your_vapid_key_here

# Configuration DataStax Astra
REACT_APP_ASTRA_DB_ID=your_astra_db_id
REACT_APP_ASTRA_DB_REGION=your_astra_region
REACT_APP_ASTRA_DB_KEYSPACE=rail_elearning
REACT_APP_ASTRA_DB_APPLICATION_TOKEN=your_astra_token

# Configuration Langflow
REACT_APP_LANGFLOW_API_URL=https://api.langflow.com

# Configuration Analytics
REACT_APP_GA_MEASUREMENT_ID=GA_MEASUREMENT_ID
"@
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-Success "Fichier .env créé dans frontend/"
    Write-Warning "⚠️  Veuillez configurer vos variables d'environnement dans frontend/.env"
} else {
    Write-Success "Fichier .env existe déjà"
}

# Installer les dépendances frontend
if (-not $SkipDependencies) {
    Write-Status "Installation des dépendances frontend..."
    Set-Location frontend
    npm install
    Set-Location ..
    Write-Success "Dépendances frontend installées"
} else {
    Write-Warning "Installation des dépendances ignorée"
}

# Installer les dépendances backend si le dossier existe
if (Test-Path "backend") {
    Write-Status "Installation des dépendances backend..."
    Set-Location backend
    npm install
    Set-Location ..
    Write-Success "Dépendances backend installées"
}

# Installer Firebase CLI globalement
if (-not $SkipFirebase) {
    Write-Status "Installation de Firebase CLI..."
    try {
        $firebaseVersion = firebase --version
        Write-Success "Firebase CLI $firebaseVersion déjà installé"
    } catch {
        npm install -g firebase-tools
        Write-Success "Firebase CLI installé"
    }
} else {
    Write-Warning "Installation de Firebase CLI ignorée"
}

# Créer les dossiers nécessaires
Write-Status "Création des dossiers nécessaires..."
$directories = @(
    "frontend\public\images",
    "frontend\src\assets",
    "frontend\src\types",
    "frontend\src\utils",
    "frontend\src\services",
    "backend\functions",
    "docs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

Write-Success "Dossiers créés"

# Créer un script de démarrage PowerShell
Write-Status "Création du script de démarrage..."
$startScript = @"
# Script de démarrage pour Rail E-Learning
Write-Host "🚀 Démarrage de Rail E-Learning..." -ForegroundColor Cyan

# Vérifier si les variables d'environnement sont configurées
if ((Get-Content "frontend\.env") -match "your_api_key_here") {
    Write-Host "⚠️  Variables d'environnement non configurées" -ForegroundColor Yellow
    Write-Host "   Veuillez configurer frontend\.env avant de continuer" -ForegroundColor Yellow
    exit 1
}

# Démarrer l'application
Set-Location frontend
npm start
"@

$startScript | Out-File -FilePath "start.ps1" -Encoding UTF8
Write-Success "Script de démarrage créé (start.ps1)"

# Créer un script de build PowerShell
Write-Status "Création du script de build..."
$buildScript = @"
# Script de build pour Rail E-Learning
Write-Host "🔨 Build de Rail E-Learning..." -ForegroundColor Cyan

# Vérifier si les variables d'environnement sont configurées
if ((Get-Content "frontend\.env") -match "your_api_key_here") {
    Write-Host "⚠️  Variables d'environnement non configurées" -ForegroundColor Yellow
    Write-Host "   Veuillez configurer frontend\.env avant de continuer" -ForegroundColor Yellow
    exit 1
}

# Build de l'application
Set-Location frontend
npm run build
Set-Location ..

Write-Host "✅ Build terminé avec succès" -ForegroundColor Green
Write-Host "📁 Les fichiers de production sont dans frontend\build\" -ForegroundColor Green
"@

$buildScript | Out-File -FilePath "build.ps1" -Encoding UTF8
Write-Success "Script de build créé (build.ps1)"

# Créer un script de déploiement PowerShell
Write-Status "Création du script de déploiement..."
$deployScript = @"
# Script de déploiement pour Rail E-Learning
Write-Host "🚀 Déploiement de Rail E-Learning..." -ForegroundColor Cyan

# Vérifier si Firebase CLI est installé
try {
    firebase --version | Out-Null
} catch {
    Write-Host "❌ Firebase CLI n'est pas installé" -ForegroundColor Red
    Write-Host "   Exécutez: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

# Vérifier si l'utilisateur est connecté à Firebase
try {
    firebase projects:list | Out-Null
} catch {
    Write-Host "❌ Vous n'êtes pas connecté à Firebase" -ForegroundColor Red
    Write-Host "   Exécutez: firebase login" -ForegroundColor Red
    exit 1
}

# Build de l'application
Write-Host "🔨 Build de l'application..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Set-Location ..

# Déploiement sur Firebase
Write-Host "🚀 Déploiement sur Firebase..." -ForegroundColor Yellow
firebase deploy

Write-Host "✅ Déploiement terminé avec succès" -ForegroundColor Green
"@

$deployScript | Out-File -FilePath "deploy.ps1" -Encoding UTF8
Write-Success "Script de déploiement créé (deploy.ps1)"

# Afficher les prochaines étapes
Write-Host ""
Write-Host "🎉 Installation terminée avec succès !" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prochaines étapes :" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 🔧 Configurer les variables d'environnement :" -ForegroundColor White
Write-Host "   - Éditer frontend\.env" -ForegroundColor Gray
Write-Host "   - Configurer Firebase (https://console.firebase.google.com)" -ForegroundColor Gray
Write-Host "   - Configurer DataStax Astra (https://astra.datastax.com)" -ForegroundColor Gray
Write-Host "   - Configurer Langflow (https://langflow.com)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 🚀 Démarrer l'application :" -ForegroundColor White
Write-Host "   .\start.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 🔨 Build pour la production :" -ForegroundColor White
Write-Host "   .\build.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "4. 🚀 Déployer sur Firebase :" -ForegroundColor White
Write-Host "   .\deploy.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "5. 📚 Documentation :" -ForegroundColor White
Write-Host "   - README.md pour les détails" -ForegroundColor Gray
Write-Host "   - docs\ pour la documentation technique" -ForegroundColor Gray
Write-Host ""
Write-Host "🔗 Liens utiles :" -ForegroundColor Cyan
Write-Host "   - Firebase Console: https://console.firebase.google.com" -ForegroundColor Gray
Write-Host "   - DataStax Astra: https://astra.datastax.com" -ForegroundColor Gray
Write-Host "   - Langflow: https://langflow.com" -ForegroundColor Gray
Write-Host "   - GitHub Actions: https://github.com/features/actions" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Conseils :" -ForegroundColor Cyan
Write-Host "   - Utilisez 'npm run lint' pour vérifier le code" -ForegroundColor Gray
Write-Host "   - Utilisez 'npm test' pour exécuter les tests" -ForegroundColor Gray
Write-Host "   - Consultez les logs Firebase avec 'firebase emulators:start'" -ForegroundColor Gray
Write-Host ""
Write-Success "Installation terminée ! 🎉" 