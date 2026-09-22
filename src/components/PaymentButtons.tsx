import type { PaymentOption } from './paymentOptions';

interface ButtonRowProps<T extends string> {
  items: PaymentOption<T>[];
  selected: T;
  onSelect: (type: T) => void;
  disabledTypes?: T[];
}

export default function ButtonRow<T extends string>({ items, selected, onSelect, disabledTypes }: ButtonRowProps<T>) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((btn) => {
        const isDisabled = disabledTypes?.includes(btn.type) ?? false;
        return (
          <button
            key={btn.type}
            type="button"
            onClick={() => !isDisabled && onSelect(btn.type)}
            disabled={isDisabled}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-white font-semibold transition-all ${btn.color} ${
              isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : selected === btn.type ? 'ring-2 ring-offset-2 ring-black' : 'opacity-70'
            }`}
          >
            {btn.icon}
            <span className="text-sm">{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
}
