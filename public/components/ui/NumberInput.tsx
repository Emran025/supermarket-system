"use client";

import { Icon } from "@/lib/icons";
import React, { useRef } from "react";

interface NumberInputProps {
    value: string | number;
    onChange: (value: string) => void;
    min?: number;
    max?: number;
    step?: number;
    id?: string;
    label?: string;
    required?: boolean;
    readOnly?: boolean;
    className?: string;
    placeholder?: string;
    suffix?: string;
}

export function NumberInput({
    value,
    onChange,
    min,
    max,
    step = 1,
    id,
    label,
    required,
    readOnly,
    className = "",
    placeholder,
    suffix
}: NumberInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleIncrement = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent focus loss if possible
        if (readOnly) return;
        const current = parseFloat(String(value)) || 0;
        const next = current + step;
        if (max !== undefined && next > max) return;
        onChange(String(next));
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.preventDefault();
        if (readOnly) return;
        const current = parseFloat(String(value)) || 0;
        const next = current - step;
        if (min !== undefined && next < min) return;
        onChange(String(next));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) {
            if (value === "") return; // Allow empty
            if (min !== undefined) onChange(String(min));
            return;
        }
        if (min !== undefined && val < min) val = min;
        if (max !== undefined && val > max) val = max;
        onChange(String(val));
    };

    return (
        <div className={`number-input-container ${className}`}>
            {label && <label htmlFor={id}>{label}</label>}
            <div className={`number-input-wrapper ${readOnly ? "readonly" : ""}`}>
                <input
                    ref={inputRef}
                    type="number"
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={handleBlur}
                    min={min}
                    max={max}
                    step={step}
                    required={required}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    className="no-spinner"
                />
                
                {!readOnly && (
                    <div className="custom-spinners">
                        <button
                            type="button"
                            className="spinner-btn increment"
                            onClick={handleIncrement}
                            tabIndex={-1}
                        >
                            <Icon name="chevronUp" />
                        </button>
                        <button
                            type="button"
                            className="spinner-btn decrement"
                            onClick={handleDecrement}
                            tabIndex={-1}
                        >
                            <Icon name="chevronDown" />
                        </button>
                    </div>
                )}

                {suffix && <span className="input-suffix">{suffix}</span>}
            </div>
        </div>
    );
}
