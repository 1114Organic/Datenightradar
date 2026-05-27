interface ChipInputProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function ChipInput({ label, options, value, onChange }: ChipInputProps) {
  return (
    <label className="field full">
      <span>{label}</span>
      <div className="chips">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              className={selected ? "chip selected" : "chip"}
              key={option}
              type="button"
              onClick={() => onChange(selected ? value.filter((item) => item !== option) : [...value, option])}
            >
              {option}
            </button>
          );
        })}
      </div>
    </label>
  );
}
