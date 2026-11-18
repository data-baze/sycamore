import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  searchable?: boolean;
  clearValue?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
}

export default function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchable = false,
  clearValue,
  disabled = false,
  loading = false,
  error
}: SelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const activeOption = filteredOptions[activeIndex];
  const activeOptionId = activeOption ? `${id}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, filteredOptions.length - 1)));
  }, [filteredOptions.length]);

  const openMenu = () => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    setSearch('');
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    setSearch('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  const selectOption = (option: SelectOption) => {
    if (disabled || loading) return;
    onChange(option.value);
    closeMenu(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === 'Tab' && open) {
      closeMenu();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        setActiveIndex((current) => Math.min(filteredOptions.length - 1, current + 1));
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        setActiveIndex((current) => Math.max(0, current - 1));
      }
      return;
    }

    if (open && event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (open && event.key === 'End') {
      event.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
      return;
    }

    if (event.key === 'Enter' || (event.key === ' ' && event.currentTarget === triggerRef.current)) {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else if (activeOption) {
        selectOption(activeOption);
      }
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span id={`${id}-label`} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-busy={loading || undefined}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (open) closeMenu();
          else openMenu();
        }}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-border-strong bg-surface px-3 py-2 text-left text-sm text-ink hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 break-words">{selected?.label ?? placeholder}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-muted">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-negative">{error}</p>}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-control border border-border bg-surface p-1 shadow-card">
          {searchable && (
            <input
              ref={searchRef}
              type="search"
              aria-label={`Search ${label} options`}
              aria-controls={`${id}-listbox`}
              aria-activedescendant={activeOptionId}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled || loading}
              className="mb-1 min-h-11 w-full rounded-control border border-border px-3 py-2 text-sm text-ink placeholder:text-subtle"
              placeholder={`Search ${label.toLocaleLowerCase()}`}
            />
          )}
          {clearValue !== undefined && value !== clearValue && (
            <button
              type="button"
              aria-label={`Clear ${label}`}
              disabled={disabled || loading}
              onClick={() => {
                onChange(clearValue);
                closeMenu(true);
              }}
              className="mb-1 min-h-11 w-full rounded-control px-3 py-2 text-left text-sm font-medium text-muted hover:bg-canvas disabled:opacity-50"
            >
              Clear selection
            </button>
          )}
          {loading ? (
            <p role="status" className="px-3 py-3 text-sm text-muted">Loading options…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">No options available.</p>
          ) : filteredOptions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">No options found.</p>
          ) : (
            <ul id={`${id}-listbox`} role="listbox" aria-label={`${label} options`} className="max-h-60 overflow-y-auto">
              {filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={`flex min-h-11 cursor-pointer items-center rounded-control px-3 py-2 text-sm ${
                    index === activeIndex
                      ? 'bg-brand-soft text-brand'
                      : 'text-ink hover:bg-canvas'
                  }`}
                >
                  <span className="min-w-0 break-words">{option.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
