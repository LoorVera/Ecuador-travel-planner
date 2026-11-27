<#
.SYNOPSIS
  Publica el frontend (dist/) de Ecuador Travel Planner como sitio web estático en Amazon S3.

.DESCRIPTION
  Antes de ejecutarlo, expón tus credenciales AWS (Access key y Secret key de un
  usuario/rol con permisos sobre el bucket) en la MISMA sesión de PowerShell:

    $env:AWS_ACCESS_KEY_ID     = "..."
    $env:AWS_SECRET_ACCESS_KEY = "..."
    $env:AWS_DEFAULT_REGION    = "us-east-1"

  No se usa session token: las claves son permanentes.

  Requiere AWS CLI v2 y Node/npm instalados.

.PARAMETER Bucket
  Nombre del bucket (único a nivel global, solo minúsculas, números y guiones).

.PARAMETER Region
  Región de AWS. Por defecto us-east-1.

.PARAMETER SkipBuild
  Omite `npm run build` y usa el dist/ existente.

.EXAMPLE
  ./scripts/deploy-s3.ps1 -Bucket ecuador-travel-planner-2026 -Region us-east-1
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [string]$Region = "us-east-1",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Assert-Command($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "No se encontró '$name'. $hint"
  }
}

Assert-Command "aws" "Instala AWS CLI v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
Assert-Command "npm" "Instala Node.js LTS desde https://nodejs.org/"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
  if (-not $SkipBuild) {
    Write-Host "==> Generando build de produccion (npm run build)..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "El build fallo (npm run build)." }
  }

  if (-not (Test-Path "dist/index.html")) {
    throw "No existe dist/index.html. Ejecuta sin -SkipBuild para generarlo."
  }

  Write-Host "==> Verificando bucket s3://$Bucket ..." -ForegroundColor Cyan
  aws s3api head-bucket --bucket $Bucket 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "    El bucket no existe, creandolo en $Region ..." -ForegroundColor Yellow
    if ($Region -eq "us-east-1") {
      aws s3api create-bucket --bucket $Bucket --region $Region | Out-Null
    } else {
      aws s3api create-bucket --bucket $Bucket --region $Region `
        --create-bucket-configuration LocationConstraint=$Region | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el bucket." }
  }

  Write-Host "==> Desbloqueando acceso publico del bucket..." -ForegroundColor Cyan
  aws s3api put-public-access-block --bucket $Bucket `
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo desactivar 'Block Public Access'. Revisa los permisos IAM y la guia (docs/DESPLIEGUE-S3.md)."
  }

  Write-Host "==> Configurando hosting de sitio web estatico (SPA)..." -ForegroundColor Cyan
  aws s3 website "s3://$Bucket/" --index-document index.html --error-document index.html
  if ($LASTEXITCODE -ne 0) { throw "No se pudo configurar el sitio web estatico." }

  Write-Host "==> Aplicando politica de lectura publica..." -ForegroundColor Cyan
  $policy = [ordered]@{
    Version   = "2012-10-17"
    Statement = @(
      [ordered]@{
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "arn:aws:s3:::$Bucket/*"
      }
    )
  } | ConvertTo-Json -Depth 5
  $policyFile = Join-Path $env:TEMP "s3-policy-$Bucket.json"
  $policy | Out-File -FilePath $policyFile -Encoding ascii
  aws s3api put-bucket-policy --bucket $Bucket --policy "file://$policyFile"
  if ($LASTEXITCODE -ne 0) { throw "No se pudo aplicar la politica del bucket." }

  Write-Host "==> Subiendo dist/ a s3://$Bucket ..." -ForegroundColor Cyan
  aws s3 sync dist "s3://$Bucket" --delete
  if ($LASTEXITCODE -ne 0) { throw "Fallo la subida con 'aws s3 sync'." }

  Write-Host "==> Ajustando Content-Type y cache..." -ForegroundColor Cyan
  aws s3 cp dist/index.html "s3://$Bucket/index.html" `
    --content-type "text/html; charset=utf-8" --cache-control "no-cache" --metadata-directive REPLACE | Out-Null
  aws s3 cp dist/favicon.svg "s3://$Bucket/favicon.svg" `
    --content-type "image/svg+xml" --metadata-directive REPLACE | Out-Null
  aws s3 cp dist/icons.svg "s3://$Bucket/icons.svg" `
    --content-type "image/svg+xml" --metadata-directive REPLACE | Out-Null
  aws s3 cp "dist/assets" "s3://$Bucket/assets" --recursive `
    --cache-control "public, max-age=31536000, immutable" --metadata-directive REPLACE | Out-Null

  $url = "http://$Bucket.s3-website-$Region.amazonaws.com"
  Write-Host ""
  Write-Host "=====================================================" -ForegroundColor Green
  Write-Host " Sitio publicado: $url" -ForegroundColor Green
  Write-Host "=====================================================" -ForegroundColor Green
  Write-Host "Abre el enlace y prueba /, /resenas y /mapas." -ForegroundColor Green
} finally {
  Pop-Location
}
