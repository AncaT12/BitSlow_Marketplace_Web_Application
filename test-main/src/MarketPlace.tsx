import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";
import { Login } from "./LogIn";
import { SignUp } from "./SignUp";

// Interfaces for coin
interface Coin {
	coin_id: number;
	value: number;
	bit1: number;
	bit2: number;
	bit3: number;
	client_id: number | null;
	owner_name: string | null;
	computedBitSlow: string;
}

// The structure of the API response when fetching coins.
interface CoinsResponse {
	coins: Coin[];
	total: number;
	page: number;
	limit: number;
}

// The TransactionHistory interface for coin history entries.
interface TransactionHistory {
	id: number;
	coin_id: number;
	transaction_date: string;
	seller_name: string | null;
	buyer_name: string;
}

const ENDPOINT_URL = "http://localhost:3000/";

function MarketPlace() {
	// State to store coins data.
	const [coins, setCoins] = useState<Coin[]>([]);
	// State to store the total number of coins.
	const [total, setTotal] = useState(0);
	// State for current page.
	const [page, setPage] = useState(1);
	// The limit is set to 30 and does not change.
	const [limit] = useState(30);
	// Loading and error states for data fetching.
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// State to disable coin generation if no unique combinations remain.
	const [canGenerate, setCanGenerate] = useState(true);
	// States to control modal visibility for login and sign-up.
	const [showLogin, setShowLogin] = useState(false);
	const [showSignUp, setShowSignUp] = useState(false);
	// A refresh state to force re-fetching coins when needed.
	const [refresh, setRefresh] = useState(0);

	// States for the current user's ID and name.
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	const [currentUserName, setCurrentUserName] = useState<string | null>(null);
	// On component mount, restore user info from localStorage.
	useEffect(() => {
		const savedId = localStorage.getItem("userId");
		const savedName = localStorage.getItem("userName");
		if (savedId) setCurrentUserId(Number.parseInt(savedId, 10));
		if (savedName) setCurrentUserName(savedName);
	}, []);

	// States for coin history modal and selected coin.
	const [showHistoryModal, setShowHistoryModal] = useState(false);
	const [history, setHistory] = useState<TransactionHistory[]>([]);
	const [selectedCoin, setSelectedCoin] = useState<null | Coin>(null);

	// useEffect to fetch coins from the API whenever page, limit, or refresh changes.
	useEffect(() => {
		console.log("Refresh trigger:", refresh);
		let isMounted = true; // Prevent state updates if unmounted
		(async () => {
			try {
				setLoading(true);
				setError(null);

				// Build query parameters for pagination.
				const queryParams = new URLSearchParams();
				queryParams.set("page", page.toString());
				queryParams.set("limit", limit.toString());

				// Fetch coins from the API.
				const res = await fetch(
					`${ENDPOINT_URL}api/coins?${queryParams.toString()}`,
				);
				// If the response is not OK, update error state and exit.
				if (!res.ok) {
					const text = await res.text();
					if (isMounted) setError(text || "Failed to fetch coins");
					return;
				}
				// Parse the response.
				const data: CoinsResponse = await res.json();
				// Update state if the component is still mounted.
				if (isMounted) {
					setCoins(data.coins);
					setTotal(data.total);
				}
			} catch (err) {
				if (isMounted)
					setError(err instanceof Error ? err.message : "Error fetching coins");
			} finally {
				if (isMounted) setLoading(false);
			}
		})();

		// Cleanup function: mark component as unmounted.
		return () => {
			isMounted = false;
		};
	}, [page, limit, refresh]);

	// Function to update the profile data (stored in localStorage) for the current user.
	async function updateProfileData() {
		if (!currentUserId) return;
		try {
			const res = await fetch(
				`${ENDPOINT_URL}api/profile?userId=${currentUserId}`,
			);
			if (res.ok) {
				const profileData = await res.json();
				localStorage.setItem("profileData", JSON.stringify(profileData));
			}
		} catch (err) {
			console.error("Error updating profile data", err);
		}
	}

	// Handler for buying a coin.
	async function handleBuy(coin: Coin) {
		if (!currentUserId) {
			// If the user is not logged in, ask if they want to log in.
			const confirmed = window.confirm(
				"You must be logged in to buy a coin. Do you want to log in now?",
			);
			if (confirmed) {
				setShowLogin(true);
			}
			return; // Stop here if not logged in
		}
		try {
			const res = await fetch(`${ENDPOINT_URL}api/buy`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					coin_id: coin.coin_id,
					buyer_id: currentUserId,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.message || "Error buying coin");
				return;
			}
			alert("Coin purchased successfully!");

			// Update coins list to reflect the new owner.
			setCoins((prev) =>
				prev.map((c) =>
					c.coin_id === coin.coin_id
						? { ...c, client_id: currentUserId, owner_name: currentUserName }
						: c,
				),
			);

			await updateProfileData();
			// Refresh list by resetting the page.
			setPage(1); // refresh list
		} catch (err) {
			alert(err instanceof Error ? err.message : "Error buying coin");
		}
	}

	// Handler for generating a new coin.
	async function handleGenerate() {
		if (!currentUserId) {
			// Require the user to be logged in to generate a coin.
			const confirmed = window.confirm(
				"You must be logged in to generate a coin. Do you want to log in now?",
			);
			if (confirmed) {
				setShowLogin(true);
			}
			return; // Stop here if not logged in
		}
		// Prompt user for the coin amount.
		const amountInput = prompt("Enter the amount for the new coin:");
		if (!amountInput) return;
		const amount = Number.parseFloat(amountInput);
		if (Number.isNaN(amount)) {
			alert("Invalid amount entered.");
			return;
		}
		try {
			const res = await fetch(`${ENDPOINT_URL}api/generate-coin`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ amount }),
			});
			const data = await res.json();
			if (!res.ok) {
				// If the error indicates no unique combinations remain, disable generation.
				if (data.message?.includes("No unique combinations remaining")) {
					setCanGenerate(false);
					alert("No unique combinations remaining. Generation disabled.");
				} else {
					setError(data.message || "Error generating coin");
					return;
				}
			} else {
				alert("Coin generated successfully!");
				await updateProfileData();
				// Trigger a refresh of the coin list.
				setRefresh((prev) => prev + 1);
				setPage(1); // refresh list
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : "Error generating coin");
		}
	}

	// Handler for viewing the history of a coin.
	async function handleViewHistory(coin: Coin) {
		try {
			const res = await fetch(
				`${ENDPOINT_URL}api/coin-history?coin_id=${coin.coin_id}`,
			);
			if (!res.ok) {
				const text = await res.text();
				setError(text || "Failed to fetch coin history");
				return;
			}
			const data = await res.json();
			setHistory(data.history);
			setSelectedCoin(coin);
			setShowHistoryModal(true);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Error fetching coin history");
		}
	}

	return (
		<div className="max-w-7xl mx-auto p-4">
			{/* Top Bar with title and navigation buttons */}
			<h1 className="text-3xl font-bold mb-4">BitSlow Marketplace</h1>

			<div className="mb-4">
				{canGenerate && (
					<button
						type="button"
						onClick={handleGenerate}
						className="bg-green-600 text-white py-2 px-4 rounded-lg"
					>
						Generate Coin
					</button>
				)}
				<button
					type="button"
					onClick={() => {
						window.location.href = "index.html";
					}}
					className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
				>
					Go Back
				</button>
			</div>

			{loading ? (
				<div className="flex justify-center items-center h-64">
					<div className="w-16 h-16 border-t-4 border-b-4 border-blue-500 rounded-full animate-spin" />
				</div>
			) : error ? (
				<div className="text-red-500">{error}</div>
			) : coins.length === 0 ? (
				<p>No coins available.</p>
			) : (
				<div className="overflow-x-auto rounded-lg shadow-md">
					<table className="w-full border-collapse bg-white">
						<thead>
							<tr className="bg-gray-800 text-white">
								<th className="p-4 text-left">Hash</th>
								<th className="p-4 text-left">Components</th>
								<th className="p-4 text-left">Value</th>
								<th className="p-4 text-left">Client</th>
								<th className="p-4 text-center">Actions</th>
							</tr>
						</thead>
						<tbody>
							{coins.map((coin) => (
								<tr key={coin.coin_id} className="hover:bg-gray-50 border-b">
									<td className="p-4 text-sm text-gray-800">
										{coin.computedBitSlow}
									</td>
									<td className="p-4">
										{coin.bit1}, {coin.bit2}, {coin.bit3}
									</td>
									<td className="p-4">${coin.value.toLocaleString()}</td>
									<td className="p-4">
										{coin.owner_name ? coin.owner_name : "Unowned"}
									</td>
									<td className="p-4 text-center space-x-2">
										{currentUserId && coin.client_id === currentUserId ? (
											<span className="text-gray-500">Owned</span>
										) : (
											<button
												type="button"
												onClick={() => handleBuy(coin)}
												className="bg-blue-500 text-white py-1 px-3 rounded"
											>
												Buy
											</button>
										)}
										<button
											type="button"
											onClick={() => handleViewHistory(coin)}
											className="bg-indigo-500 text-white py-1 px-3 rounded"
										>
											View History
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Pagination Controls */}
			<div className="flex items-center mt-4 space-x-4">
				<button
					type="button"
					onClick={() => setPage(Math.max(1, page - 1))}
					disabled={page <= 1}
					className="bg-gray-300 text-black py-1 px-3 rounded disabled:opacity-50"
				>
					Prev
				</button>
				<span>Page {page}</span>
				<button
					type="button"
					onClick={() => setPage(page + 1)}
					disabled={page * limit >= total}
					className="bg-gray-300 text-black py-1 px-3 rounded disabled:opacity-50"
				>
					Next
				</button>
				<span className="text-sm text-gray-600">(Total: {total} coins)</span>
			</div>

			{/* Modal for history */}
			{showHistoryModal && selectedCoin && (
				<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
					<div className="bg-white p-6 rounded-lg max-w-md w-full">
						<h2 className="text-xl font-bold mb-4">
							History for {selectedCoin.computedBitSlow}
						</h2>
						{history.length === 0 ? (
							<p className="text-gray-600">No history available.</p>
						) : (
							<ul className="mb-4">
								{history.map((entry) => (
									<li key={entry.id} className="mb-2">
										<span className="font-semibold">
											{new Date(entry.transaction_date).toLocaleString()}:
										</span>{" "}
										{entry.seller_name
											? `${entry.seller_name} → `
											: "Original Issuer → "}
										{entry.buyer_name}
									</li>
								))}
							</ul>
						)}
						<button
							type="button"
							onClick={() => setShowHistoryModal(false)}
							className="bg-gray-300 text-black py-1 px-3 rounded"
						>
							Close
						</button>
					</div>
				</div>
			)}
			{/* LOGIN Modal */}
			{showLogin && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
						<Login
							endpointUrl={ENDPOINT_URL}
							onLoginSuccess={(userId, userName) => {
								setCurrentUserId(userId);
								setCurrentUserName(userName);
								localStorage.setItem("userId", userId.toString());
								localStorage.setItem("userName", userName);
								setShowLogin(false);
							}}
							onClose={() => setShowLogin(false)}
							onSwitchToSignUp={() => {
								setShowLogin(false);
								setShowSignUp(true);
							}}
						/>
					</div>
				</div>
			)}

			{/* SIGN UP Modal */}
			{showSignUp && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
						<SignUp
							endpointUrl={ENDPOINT_URL}
							onClose={() => setShowSignUp(false)}
							onSwitchToLogin={() => {
								setShowSignUp(false);
								setShowLogin(true);
							}}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

function start() {
	const rootElement = document.getElementById("marketplace-root");
	if (!rootElement) return;
	const root = createRoot(rootElement);
	root.render(<MarketPlace />);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", start);
} else {
	start();
}
