import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface AddressSuggestion {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    postcode?: string;
    state?: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: {
    indirizzo: string;
    citta: string;
    cap: string;
  }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Inizia a digitare l'indirizzo...",
  label,
  className = ""
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Se l'utente ha già inserito un valore e non ci sono suggerimenti, permetti l'inserimento manuale
    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    // Se l'utente ha digitato qualcosa ma non ci sono suggerimenti dopo un po', permetti l'inserimento manuale
    if (value.length >= 3 && !isLoading && suggestions.length === 0 && showSuggestions) {
      // L'utente può continuare a digitare manualmente
      return;
    }

    // Debounce per evitare troppe chiamate API
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value]);

  const searchAddresses = async (query: string) => {
    if (query.length < 3) return;

    setIsLoading(true);
    try {
      // Usa Nominatim API per cercare indirizzi italiani
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query + ', Italia')}&` +
        `format=json&` +
        `addressdetails=1&` +
        `limit=5&` +
        `countrycodes=it&` +
        `accept-language=it`
      );

      if (response.ok) {
        const data: AddressSuggestion[] = await response.json();
        setSuggestions(data);
        // Mostra i suggerimenti solo se ci sono risultati, altrimenti l'utente può inserire manualmente
        setShowSuggestions(data.length > 0);
      } else {
        // Se la richiesta fallisce, permetti comunque l'inserimento manuale
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Errore ricerca indirizzo:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (suggestion: AddressSuggestion): {
    indirizzo: string;
    citta: string;
    cap: string;
  } => {
    const addr = suggestion.address;
    const road = addr.road || '';
    const houseNumber = addr.house_number || '';
    const indirizzo = houseNumber ? `${road}, ${houseNumber}` : road;
    const citta = addr.city || addr.town || '';
    const cap = addr.postcode || '';

    return {
      indirizzo: indirizzo.trim(),
      citta: citta.trim(),
      cap: cap.trim()
    };
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    const formatted = formatAddress(suggestion);
    onChange(formatted.indirizzo);
    onSelect(formatted);
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm outline-none"
        />
        <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-3.5 w-5 h-5 text-gray-400 animate-spin" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => {
            const formatted = formatAddress(suggestion);
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                  index === selectedIndex ? 'bg-blue-50' : ''
                } ${index !== suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {formatted.indirizzo || suggestion.display_name.split(',')[0]}
                    </div>
                    {(formatted.citta || formatted.cap) && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatted.citta}
                        {formatted.citta && formatted.cap && ' • '}
                        {formatted.cap && `CAP ${formatted.cap}`}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

