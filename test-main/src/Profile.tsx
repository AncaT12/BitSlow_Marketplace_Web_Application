import { createRoot } from "react-dom/client";
import React, { useEffect, useState, useCallback } from "react";

// The shape of the profile data returned by the API.
interface ProfileData {
	totalTransactions: number;
	totalBitSlow: number;
	totalValue: number;
}

// ProfilePage component displays the user's profile data.
function ProfilePage() {
	const [profileData, setProfileData] = useState<ProfileData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState<string | null>(null);

	// Define fetchProfileData as a callback so that its reference remains stable
	// This helps avoid re-running useEffect unnecessarily.
	const fetchProfileData = useCallback(async (userId: string) => {
		setLoading(true);
		try {
			// Send a GET request to the profile API with the provided userId.
			const res = await fetch(
				`http://localhost:3000/api/profile?userId=${userId}`,
			);
			if (!res.ok) {
				const text = await res.text();
				setError(text || "Failed to fetch data");
				return;
			}
			// Parse the JSON response and update the profileData state.
			const data: ProfileData = await res.json();
			setProfileData(data);
			// Store the profile data in localStorage for quick retrieval later.
			localStorage.setItem("profileData", JSON.stringify(data));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Error loading profile data.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	// useEffect hook to run on component mount.
	// It reads URL parameters for userId and userName and then fetches profile data.
	useEffect(() => {
		// Read userId and userName from URL parameters
		const params = new URLSearchParams(window.location.search);
		const userId = params.get("userId");
		const name = params.get("userName");
		if (name) {
			setUserName(name);
		}
		if (!userId) {
			setError("Missing userId in URL.");
			setLoading(false);
			return;
		}

		// Load stored profile data
		const storedProfile = localStorage.getItem("profileData");
		if (storedProfile) {
			try {
				const parsed = JSON.parse(storedProfile) as ProfileData;
				setProfileData(parsed);
			} catch (e) {
				console.error("Error parsing stored profile data", e);
			}
		}

		// Then, fetch fresh profile data from the API using the stable fetchProfileData callback.
		(async () => {
			try {
				await fetchProfileData(userId);
			} catch (e) {
				console.error(e);
			}
		})();
	}, [fetchProfileData]);

	// Render the profile page UI.
	return (
		<div className="p-6">
			{/* Display the user's name */}
			{userName && (
				<h2 className="text-2xl font-semibold mb-6 text-gray-700">
					{userName} Profile
				</h2>
			)}
			{/* Refresh Profile button triggers fetchProfileData again */}
			<button
				type="button"
				onClick={() => {
					const params = new URLSearchParams(window.location.search);
					const userId = params.get("userId");
					if (userId) {
						fetchProfileData(userId).catch((err) => console.error(err));
					}
				}}
				className="bg-blue-500 text-white py-2 px-4 rounded mb-4"
			>
				Refresh Profile
			</button>
			{loading && !profileData ? (
				<p className="p-4">Loading profile...</p>
			) : error ? (
				<p className="p-4 text-red-500">{error}</p>
			) : profileData ? (
				<>
					<table className="w-full table-auto border text-left mb-8">
						<tbody>
							<tr>
								<th className="p-4 border bg-gray-100 w-1/3">
									Total Transactions
								</th>
								<td className="p-4 border">{profileData.totalTransactions}</td>
							</tr>
							<tr>
								<th className="p-4 border bg-gray-100">Total BitSlow Owned</th>
								<td className="p-4 border">{profileData.totalBitSlow}</td>
							</tr>
							<tr>
								<th className="p-4 border bg-gray-100">Total Value</th>
								<td className="p-4 border">
									${profileData.totalValue.toLocaleString()}
								</td>
							</tr>
						</tbody>
					</table>
					{/* Go Back button navigates back to the main page */}
					<button
						type="button"
						onClick={() => {
							window.location.href = "index.html";
						}}
						className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
					>
						Go Back
					</button>
				</>
			) : (
				// Fallback UI if no profile data is available.
				<p className="p-4">No profile data.</p>
			)}
		</div>
	);
}

// The start function renders the ProfilePage component into the DOM element with the id "profile-root".
function start() {
	const rootElement = document.getElementById("profile-root");
	if (!rootElement) return;
	const root = createRoot(rootElement);
	root.render(<ProfilePage />);
}

// Wait for the DOM to load before starting the app.
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", start);
} else {
	start();
}
