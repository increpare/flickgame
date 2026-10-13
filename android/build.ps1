param(
    [ValidateSet('Debug', 'Release', 'Verify', 'All')]
    [string]$Target = 'Debug'
)

$ErrorActionPreference = 'Stop'
$taskTools = Join-Path $PSScriptRoot '.toolchain'
if (-not $env:JAVA_HOME) {
    $taskJava = Get-ChildItem (Join-Path $taskTools 'java') -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1
    if ($taskJava) { $env:JAVA_HOME = $taskJava.FullName }
    elseif (Test-Path "$env:ProgramFiles\Android\Android Studio\jbr\bin\java.exe") {
        $env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr"
    }
}
if (-not $env:JAVA_HOME -and -not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw 'Install JDK 17 or Android Studio and set JAVA_HOME. See android/README.md.'
}
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    foreach ($taskSdk in @((Join-Path $taskTools 'sdk'), "$env:LOCALAPPDATA\Android\Sdk")) {
        if (Test-Path (Join-Path $taskSdk 'platforms\android-36\android.jar')) {
            $env:ANDROID_HOME = $taskSdk
            break
        }
    }
}
if (-not $env:ANDROID_HOME -and $env:ANDROID_SDK_ROOT) { $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT }
if (-not $env:ANDROID_HOME -and -not (Test-Path (Join-Path $PSScriptRoot 'local.properties'))) {
    throw 'Install SDK Platform 36 and Build Tools 35.0.0 and set ANDROID_HOME. See android/README.md.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 18 or newer and add it to PATH for the offline assets.'
}
if ((Test-Path $taskTools) -and -not $env:GRADLE_USER_HOME) {
    $env:GRADLE_USER_HOME = Join-Path $taskTools 'gradle'
}
$taskGradleTargets = switch ($Target) {
    'Debug' { 'assembleDebug' }
    'Release' { 'bundleRelease' }
    'Verify' { 'testDebugUnitTest'; 'lintDebug'; 'assembleDebugAndroidTest' }
    'All' { 'testDebugUnitTest'; 'lintDebug'; 'assembleDebug'; 'assembleDebugAndroidTest'; 'bundleRelease' }
}
Push-Location $PSScriptRoot
try {
    if ($Target -in @('Verify', 'All')) {
        # Expand explicitly for Node versions that do not expand Windows wildcards.
        $taskTests = @(Get-ChildItem (Join-Path $PSScriptRoot 'test\*.test.cjs') | ForEach-Object FullName)
        & node --test @taskTests
        if ($LASTEXITCODE -ne 0) { throw 'Android asset/bridge tests failed.' }
    }
    & (Join-Path $PSScriptRoot 'gradlew.bat') @taskGradleTargets --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Android $Target build failed (exit $LASTEXITCODE)." }
} finally {
    Pop-Location
}
