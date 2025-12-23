import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Save, Package, AlertCircle, Home } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { IOSCard, IOSInput, IOSSelect } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';

export default function NuovoProdottoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!id;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      codice_articolo: '',
      descrizione: '',
      prezzo_vendita: 0,
      costo_acquisto: 0,
      giacenza: 0,
      categoria: 'Prodotto' // Valore predefinito
    }
  });

  useEffect(() => {
    if (isEdit && id) {
      loadProdotto();
    }
  }, [id, isEdit]);

  const loadProdotto = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/magazzino/`);
      const prodotto = res.data.find((p: any) => p.id === parseInt(id!));
      if (prodotto) {
        setValue('codice_articolo', prodotto.codice_articolo || '');
        setValue('descrizione', prodotto.descrizione || '');
        setValue('prezzo_vendita', prodotto.prezzo_vendita || 0);
        setValue('costo_acquisto', prodotto.costo_acquisto || 0);
        setValue('giacenza', prodotto.giacenza || 0);
        setValue('categoria', prodotto.categoria || 'Prodotto');
      }
    } catch (err) {
      setError('Errore nel caricamento del prodotto');
    }
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    setError('');

    try {
      if (isEdit) {
        await axios.put(`${getApiUrl()}/magazzino/${id}`, {
          codice_articolo: data.codice_articolo,
          descrizione: data.descrizione,
          prezzo_vendita: parseFloat(data.prezzo_vendita) || 0,
          costo_acquisto: parseFloat(data.costo_acquisto) || 0,
          giacenza: parseInt(data.giacenza) || 0,
          categoria: data.categoria || null
        });
        alert('Prodotto aggiornato con successo!');
      } else {
        await axios.post(`${getApiUrl()}/magazzino/`, {
          codice_articolo: data.codice_articolo,
          descrizione: data.descrizione,
          prezzo_vendita: parseFloat(data.prezzo_vendita) || 0,
          costo_acquisto: parseFloat(data.costo_acquisto) || 0,
          giacenza: parseInt(data.giacenza) || 0,
          categoria: data.categoria || null
        });
        alert('Prodotto creato con successo!');
      }
      navigate('/admin?tab=magazzino');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Errore durante il salvataggio';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100"
            title="Home"
          >
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-600 rounded-full hover:bg-gray-100"
            title="Torna indietro"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <IOSCard>
            <div className="flex items-center gap-2 mb-6">
              <Package className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">Dati Prodotto</h2>
            </div>

            <IOSInput
              label="Codice Articolo *"
              {...register('codice_articolo', { 
                required: 'Campo obbligatorio'
              })}
            />
            {errors.codice_articolo && (
              <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.codice_articolo.message)}</p>
            )}

            <IOSInput
              label="Descrizione *"
              {...register('descrizione', { required: 'Campo obbligatorio' })}
            />
            {errors.descrizione && (
              <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.descrizione.message)}</p>
            )}

            <IOSSelect
              label="Categoria"
              {...register('categoria')}
              options={[
                { value: 'Prodotto', label: 'Prodotto' },
                { value: 'Ricambio', label: 'Ricambio' },
                { value: 'Consumabili', label: 'Consumabili' }
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <IOSInput
                label="Prezzo Vendita (€)"
                type="number"
                step="0.01"
                {...register('prezzo_vendita', { valueAsNumber: true })}
              />
              <IOSInput
                label="Costo Acquisto (€)"
                type="number"
                step="0.01"
                {...register('costo_acquisto', { valueAsNumber: true })}
              />
            </div>

            <IOSInput
              label="Giacenza"
              type="number"
              {...register('giacenza', { valueAsNumber: true })}
            />
          </IOSCard>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-bold transition-all"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                'Salvataggio...'
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEdit ? 'Aggiorna' : 'Crea Prodotto'}
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

