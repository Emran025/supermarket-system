"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface SelectOption {
    value: string | number;
    label: string;
    subtitle?: string;
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: string | number | null;
    onChange: (value: string | number | null, option: SelectOption | null) => void;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    name?: string;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "بحث...",
    disabled = false,
    id,
    name,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [inputValue, setInputValue] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get selected option label
    const selectedOption = Array.isArray(options) 
        ? options.find((opt) => opt.value === value)
        : null;

    // Update input value when selection changes
    useEffect(() => {
        if (selectedOption) {
            setInputValue(selectedOption.label);
            setSearchTerm("");
        } else {
            setInputValue("");
        }
    }, [selectedOption, value]);

    // Filter options based on search
    const filteredOptions = Array.isArray(options)
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : [];

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setSearchTerm(val);
        if (!isOpen) setIsOpen(true);
    };

    const handleInputFocus = () => {
        setIsOpen(true);
        if (!selectedOption) {
            setSearchTerm(inputValue);
        }
    };

    const handleOptionClick = useCallback(
        (option: SelectOption) => {
            onChange(option.value, option);
            setInputValue(option.label);
            setSearchTerm("");
            setIsOpen(false);
        },
        [onChange]
    );

    const handleClear = () => {
        onChange(null, null);
        setInputValue("");
        setSearchTerm("");
        inputRef.current?.focus();
    };

    return (
        <div className="searchable-select" ref={containerRef}>
            <input
                ref={inputRef}
                type="text"
                id={id}
                name={name}
                value={isOpen ? searchTerm : inputValue}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
            />
            {value && !isOpen && (
                <button
                    type="button"
                    onClick={handleClear}
                    style={{
                        position: "absolute",
                        left: "40px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-light)",
                        padding: "4px",
                    }}
                >
                    ×
                </button>
            )}
            <div className={`options-list ${isOpen ? "active" : ""}`}>
                {filteredOptions.length === 0 ? (
                    <div className="no-results">لا توجد نتائج</div>
                ) : (
                    filteredOptions.map((option) => (
                        <div
                            key={option.value}
                            className={`option-item ${value === option.value ? "selected" : ""}`}
                            onClick={() => handleOptionClick(option)}
                        >
                            <span className="option-name">{option.label}</span>
                            {option.subtitle && (
                                <span className="option-stock">{option.subtitle}</span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

