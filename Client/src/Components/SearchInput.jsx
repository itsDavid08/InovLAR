// Rounded search input with leading icon. `onChange` receives the string value.
const SearchInput = ({ value, onChange, placeholder, className = "", inputClassName = "" }) => (
    <div className={`relative ${className}`}>
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
        </span>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full pl-10 pr-4 py-2 rounded-full bg-surface-container border-none focus:ring-2 focus:ring-primary font-body-md text-body-md text-on-surface placeholder-on-surface-variant ${inputClassName}`}
        />
    </div>
);

export default SearchInput;
