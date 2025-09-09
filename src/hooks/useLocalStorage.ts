"use client";

import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
	// State to store our value
	const [storedValue, setStoredValue] = useState<T>(initialValue);

	// Return a wrapped version of useState's setter function that persists the new value to localStorage
	const setValue = (value: T | ((val: T) => T)) => {
		try {
			// Allow value to be a function so we have the same API as useState
			const valueToStore =
				value instanceof Function ? value(storedValue) : value;
			// Save state
			setStoredValue(valueToStore);
			// Save to local storage
			if (typeof window !== "undefined") {
				window.localStorage.setItem(key, JSON.stringify(valueToStore));
			}
		} catch (error) {
			// A more advanced implementation would handle the error case
			console.log(error);
		}
	};

	// Get from local storage then parse stored json or return initialValue
	useEffect(() => {
		try {
			if (typeof window !== "undefined") {
				const item = window.localStorage.getItem(key);
				if (item) {
					setStoredValue(JSON.parse(item));
				}
			}
		} catch (error) {
			console.log(error);
		}
	}, [key]);

	return [storedValue, setValue] as const;
}

export function clearLocalStorage(key: string) {
	try {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(key);
		}
	} catch (error) {
		console.log(error);
	}
}

export function getAllSavedStatements(): string[] {
	try {
		if (typeof window !== "undefined") {
			const keys = Object.keys(localStorage);
			return keys.filter((key) => key.startsWith("payStatement_"));
		}
	} catch (error) {
		console.log(error);
	}
	return [];
}

export function savePayStatement<T = unknown>(name: string, data: T) {
	try {
		if (typeof window !== "undefined") {
			const key = `payStatement_${name}_${Date.now()}`;
			window.localStorage.setItem(key, JSON.stringify(data));
			return key;
		}
	} catch (error) {
		console.log(error);
	}
	return null;
}

export function loadPayStatement(key: string) {
	try {
		if (typeof window !== "undefined") {
			const item = window.localStorage.getItem(key);
			if (item) {
				return JSON.parse(item);
			}
		}
	} catch (error) {
		console.log(error);
	}
	return null;
}

export function deletePayStatement(key: string) {
	try {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(key);
		}
	} catch (error) {
		console.log(error);
	}
}
