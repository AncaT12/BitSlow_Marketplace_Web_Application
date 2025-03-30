import { useState, useEffect } from "react";

/**
 * Custom hook for managing authentication state.
 * It retrieves the user ID and username from localStorage and provides
 * setter functions to update them.
 */
export function useAuth() {
	// State for the current user's ID. Initialized to null if not logged in.
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	// State for the current user's name. Initialized to null if not logged in.
	const [currentUserName, setCurrentUserName] = useState<string | null>(null);

	// On mount, check localStorage for saved authentication information.
	useEffect(() => {
		// Retrieve the user ID and username from localStorage.
		const savedId = localStorage.getItem("userId");
		const savedName = localStorage.getItem("userName");
		// If a user ID exists, parse it as a number and set it in state.
		if (savedId) setCurrentUserId(Number.parseInt(savedId, 10));
		// If a username exists, set it in state.
		if (savedName) setCurrentUserName(savedName);
	}, []); // Empty dependency array ensures this effect runs only once on mount.

	// Return the current authentication state and the setter functions.
	return {
		currentUserId,
		setCurrentUserId,
		currentUserName,
		setCurrentUserName,
	};
}
