import {useEffect, useState} from 'react';

export const InputModal = ({
                               isOpen, title, label, initialValue, onSave, onCancel, showCheckbox, checkboxLabel, checkboxValue, onCheckboxChange
                           }: {
    isOpen: boolean,
    title: string,
    label: string,
    initialValue: string,
    onSave: (val: string) => void,
    onCancel: () => void,
    showCheckbox?: boolean,
    checkboxLabel?: string,
    checkboxValue?: boolean,
    onCheckboxChange?: (val: boolean) => void
}) => {
    const [val, setVal] = useState(initialValue);
    useEffect(() => {
        if (isOpen) setVal(initialValue)
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-xl w-80 transform transition-all">
        <h3 className="font-bold mb-4 text-lg text-gray-800">{title}</h3>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">{label}</label>
        <input
    autoFocus
    className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
    value={val}
    onChange={e => setVal(e.target.value)}
    onKeyDown={e => {
        if (e.key === 'Enter') onSave(val);
    }}
    />

    {showCheckbox && (
        <div className="flex items-center gap-2 mb-4 bg-gray-50 p-2 rounded border">
        <input
            type="checkbox"
        id="independentScale"
        checked={checkboxValue}
        onChange={(e) => onCheckboxChange && onCheckboxChange(e.target.checked)}
        className="rounded text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="independentScale" className="text-xs text-gray-700 font-medium cursor-pointer select-none">
        {checkboxLabel}
        </label>
        </div>
    )}

    <div className="flex gap-2 justify-end">
    <button onClick={onCancel}
    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-medium">Cancel
        </button>
        <button onClick={() => onSave(val)}
    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-sm">Confirm
        </button>
        </div>
        </div>
        </div>
);
};