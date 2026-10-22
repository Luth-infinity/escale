const path = require('node:path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

/**
 * Verrouille les fuses d'Electron dans le binaire empaqueté (spec §9.3).
 * Lancé par electron-builder (afterPack), donc avant la signature.
 */
exports.default = async function fuses(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  const nom = packager.appInfo.productFilename;
  const binaire =
    electronPlatformName === 'darwin'
      ? path.join(appOutDir, `${nom}.app`)
      : path.join(appOutDir, `${nom}.exe`);
  await flipFuses(binaire, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true
  });
};
