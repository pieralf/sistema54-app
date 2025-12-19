import { useState, useEffect } from 'react';
import { Shield, QrCode, CheckCircle, XCircle, RefreshCw, AlertCircle, Copy, Download } from 'lucide-react';
import axios from 'axios';
import { IOSCard, IOSInput } from './ui/ios-elements';
import { getApiUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';

export default function TwoFactorSettings() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.ruolo === 'superadmin') {
      load2FAStatus();
    }
  }, [user]);

  const load2FAStatus = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/auth/me`);
      setIsEnabled(res.data.two_factor_enabled || false);
    } catch (err) {
      console.error('Errore caricamento stato 2FA:', err);
    }
  };

  const handleSetup = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${getApiUrl()}/api/auth/2fa/setup`);
      setQrCode(res.data.qr_code);
      setBackupCodes(res.data.backup_codes);
      setShowBackupCodes(true);
      setSuccess('QR code generato! Scansiona con la tua app di autenticazione.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore durante la configurazione 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError('Inserisci un codice valido a 6 cifre');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post(`${getApiUrl()}/api/auth/2fa/enable`, { code: verificationCode });
      setIsEnabled(true);
      setQrCode('');
      setVerificationCode('');
      setSuccess('2FA abilitato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Codice non valido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError('Inserisci un codice valido a 6 cifre per disabilitare');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post(`${getApiUrl()}/api/auth/2fa/disable`, { code: verificationCode });
      setIsEnabled(false);
      setQrCode('');
      setBackupCodes([]);
      setShowBackupCodes(false);
      setVerificationCode('');
      setSuccess('2FA disabilitato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Codice non valido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateBackup = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${getApiUrl()}/api/auth/2fa/regenerate-backup`);
      setBackupCodes(res.data.backup_codes);
      setShowBackupCodes(true);
      setSuccess('Nuovi codici di backup generati!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore durante la rigenerazione');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    setSuccess('Codici copiati negli appunti!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-2fa-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('Codici scaricati!');
    setTimeout(() => setSuccess(''), 2000);
  };

  if (user?.ruolo !== 'superadmin') {
    return null;
  }

  return (
    <IOSCard>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">Autenticazione a Due Fattori (2FA)</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {!isEnabled ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Cos'è l'autenticazione a due fattori?
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              L'autenticazione a due fattori (2FA) aggiunge un ulteriore livello di sicurezza al tuo account superadmin.
              Dovrai inserire un codice dalla tua app di autenticazione ogni volta che accedi.
            </p>
            <p className="text-sm text-gray-600">
              <strong>App consigliate:</strong> Authy, Google Authenticator, Microsoft Authenticator, 1Password, LastPass Authenticator
            </p>
          </div>

          {!qrCode ? (
            <div className="space-y-3">
              <button
                onClick={handleSetup}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>Caricamento...</>
                ) : (
                  <>
                    <QrCode className="w-5 h-5" />
                    Inizia Configurazione 2FA
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Clicca il pulsante sopra per generare il QR code da scansionare con la tua app
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600" />
                  Passo 1: Scansiona il QR Code
                </h3>
                <div className="space-y-3 mb-4">
                  <p className="text-sm text-gray-700 font-medium">Istruzioni:</p>
                  <ol className="text-sm text-gray-600 space-y-2 ml-4 list-decimal">
                    <li>Apri la tua app di autenticazione sul telefono (Authy, Google Authenticator, ecc.)</li>
                    <li>Clicca su "Aggiungi account" o il pulsante "+"</li>
                    <li>Seleziona "Scansiona QR code" o "Scan QR Code"</li>
                    <li>Inquadra il QR code qui sotto con la fotocamera del telefono</li>
                    <li>L'app aggiungerà automaticamente il tuo account</li>
                  </ol>
                </div>
                <div className="flex justify-center bg-white p-4 rounded-lg border-2 border-blue-300">
                  <img src={qrCode} alt="QR Code 2FA" className="w-64 h-64" />
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Non riesci a scansionare? Puoi inserire manualmente il codice segreto (disponibile dopo la scansione)
                </p>
              </div>

              {showBackupCodes && backupCodes.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">⚠️ Codici di Backup</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Salva questi codici in un posto sicuro. Puoi usarli per accedere se perdi l'accesso alla tua app di autenticazione.
                  </p>
                  <div className="bg-white p-3 rounded-lg font-mono text-sm space-y-1 mb-3">
                    {backupCodes.map((code, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>{code}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(code);
                            setSuccess(`Codice ${code} copiato!`);
                            setTimeout(() => setSuccess(''), 1000);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyBackupCodes}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copia Tutti
                    </button>
                    <button
                      onClick={downloadBackupCodes}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Scarica
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Passo 2: Verifica il Codice
                </h3>
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    Dopo aver scansionato il QR code, la tua app mostrerà un codice a 6 cifre che cambia ogni 30 secondi.
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Inserisci il codice corrente dalla tua app per completare l'attivazione:</strong>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                      className="flex-1 bg-white border-2 border-green-300 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 block px-4 py-3 transition-shadow outline-none font-mono text-center text-xl tracking-widest"
                    />
                    <button
                      onClick={handleEnable}
                      disabled={isLoading || verificationCode.length < 6}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md"
                    >
                      {isLoading ? (
                        <>...</>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Abilita 2FA
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    💡 Il codice cambia ogni 30 secondi. Se scade, attendi il nuovo codice e inseriscilo.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-gray-900">2FA Abilitato</h3>
              <p className="text-sm text-gray-600">L'autenticazione a due fattori è attiva per il tuo account.</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Disabilita 2FA</h3>
            <p className="text-sm text-gray-600 mb-3">
              Inserisci un codice dalla tua app per disabilitare 2FA:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 block px-4 py-3 transition-shadow outline-none font-mono text-center text-lg tracking-widest"
              />
              <button
                onClick={handleDisable}
                disabled={isLoading || verificationCode.length < 6}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? '...' : 'Disabilita'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Codici di Backup</h3>
            <p className="text-sm text-gray-600 mb-3">
              Rigenera i codici di backup se necessario:
            </p>
            <button
              onClick={handleRegenerateBackup}
              disabled={isLoading}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Rigenera Codici di Backup
            </button>
          </div>
        </div>
      )}
    </IOSCard>
  );
}

