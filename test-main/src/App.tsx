import "./index.css";
import { useState, useEffect } from "react";
import React from "react";
import { SignUp } from "./SignUp";
import { Login } from "./LogIn";
import { useAuth } from "./useAuth";
import type { FormEvent } from "react";

// Define the Transaction interface for transaction data
interface Transaction {
	id: number;
	coin_id: number;
	amount: number;
	transaction_date: string;
	seller_id: number | null;
	seller_name: string | null;
	buyer_id: number;
	buyer_name: string;
	bit1: number;
	bit2: number;
	bit3: number;
	value: number;
	computedBitSlow: string;
}

// Define the response interface for transactions API
interface TransactionResponse {
	transactions: Transaction[];
	total: number;
	page: number;
	limit: number;
}

// API endpoint URL constant
const ENDPOINT_URL = "http://localhost:3000/";

export function App() {
	// -------------------- Authentication States --------------------
	// Using custom hook to manage auth state (currentUserId, currentUserName)
	const {
		currentUserId,
		setCurrentUserId,
		currentUserName,
		setCurrentUserName,
	} = useAuth();

	// Restore authentication state from localStorage when component mounts
	useEffect(() => {
		const savedId = localStorage.getItem("userId");
		const savedName = localStorage.getItem("userName");
		if (savedId) setCurrentUserId(Number.parseInt(savedId, 10));
		if (savedName) setCurrentUserName(savedName);
		// We include setCurrentUserId and setCurrentUserName as dependencies
	}, [setCurrentUserId, setCurrentUserName]);

	// Local state for displaying the SignUp and Login modals
	const [showSignUp, setShowSignUp] = useState(false);
	const [showLogin, setShowLogin] = useState(false);

	// -------------------- Pagination & Query States --------------------
	// States for transactions, pagination, and error/loading tracking
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(15);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Query states for filtering transactions fetched from the API
	const [queryStartDate, setQueryStartDate] = useState("");
	const [queryEndDate, setQueryEndDate] = useState("");
	const [queryMinValue, setQueryMinValue] = useState("");
	const [queryMaxValue, setQueryMaxValue] = useState("");
	const [queryBuyerName, setQueryBuyerName] = useState("");
	const [querySellerName, setQuerySellerName] = useState("");

	// -------------------- Filter Form States (user input) --------------------
	// State to show/hide filter panel and the actual filter values from user input
	const [showFilters, setShowFilters] = useState(false);

	// Which filters are enabled (checkbox approach)
	const [enableDateRange, setEnableDateRange] = useState(false);
	const [enableValueRange, setEnableValueRange] = useState(false);
	const [enableBuyerName, setEnableBuyerName] = useState(false);
	const [enableSellerName, setEnableSellerName] = useState(false);

	// Actual form fields for each filter
	const [formStartDate, setFormStartDate] = useState("");
	const [formEndDate, setFormEndDate] = useState("");
	const [formMinValue, setFormMinValue] = useState("");
	const [formMaxValue, setFormMaxValue] = useState("");
	const [formBuyerName, setFormBuyerName] = useState("");
	const [formSellerName, setFormSellerName] = useState("");

	// -------------------- Success Message for Filters --------------------
	// Indicates when filters are applied successfully
	const [filtersApplied, setFiltersApplied] = useState(false);

	// -------------------- Authentication Handlers --------------------
	// Called after a successful login; stores user data in state and localStorage
	function handleLoginSuccess(userId: number, userName: string) {
		setCurrentUserId(userId);
		setCurrentUserName(userName);
		localStorage.setItem("userId", userId.toString());
		localStorage.setItem("userName", userName);
	}

	// Logout handler that clears the auth state and localStorage
	function handleLogout() {
		const confirmed = window.confirm("Do you really want to sign out?");
		if (!confirmed) return;
		setCurrentUserId(null);
		setCurrentUserName(null);
		localStorage.removeItem("userId");
		localStorage.removeItem("userName");
	}

	// Toggle functions for displaying modals
	function toggleSignUp() {
		setShowSignUp(!showSignUp);
	}

	function toggleLogin() {
		setShowLogin(!showLogin);
	}

	// -------------------- Fetch Data from /api/transactions --------------------
	// useEffect to fetch transactions based on pagination and filter query states

	useEffect(() => {
		let isMounted = true; // optional safeguard to avoid setting state if unmounted

		(async () => {
			try {
				setLoading(true);
				setError(null);

				// Build query parameters from state values
				const queryParams = new URLSearchParams();
				queryParams.set("page", page.toString());
				queryParams.set("limit", limit.toString());

				if (queryStartDate) queryParams.set("startDate", queryStartDate);
				if (queryEndDate) queryParams.set("endDate", queryEndDate);
				if (queryMinValue) queryParams.set("minValue", queryMinValue);
				if (queryMaxValue) queryParams.set("maxValue", queryMaxValue);
				if (queryBuyerName) queryParams.set("buyerName", queryBuyerName);
				if (querySellerName) queryParams.set("sellerName", querySellerName);

				// Fetch transactions from the API endpoint
				const res = await fetch(
					`${ENDPOINT_URL}api/transactions?${queryParams.toString()}`,
				);

				// If response is not OK, set the error state and exit early
				if (!res.ok) {
					const text = await res.text();
					if (isMounted) setError(text || "Failed to fetch transactions");
					return; // Stop here instead of throw
				}

				// Parse the JSON response into our TransactionResponse interface
				const data: TransactionResponse = await res.json();

				// Update state if the component is still mounted
				if (isMounted) {
					setTransactions(data.transactions);
					setTotal(data.total);
					// Show success message for filters if any filter is applied
					if (
						queryStartDate ||
						queryEndDate ||
						queryMinValue ||
						queryMaxValue ||
						queryBuyerName ||
						querySellerName
					) {
						setFiltersApplied(true);
						setTimeout(() => setFiltersApplied(false), 2000);
					}
				}
			} catch (err) {
				if (isMounted) {
					setError(err instanceof Error ? err.message : "Error fetching data");
				}
			} finally {
				if (isMounted) setLoading(false);
			}
		})();

		return () => {
			// Cleanup so we don't set state if component unmounts
			isMounted = false;
		};
	}, [
		page,
		limit,
		queryStartDate,
		queryEndDate,
		queryMinValue,
		queryMaxValue,
		queryBuyerName,
		querySellerName,
	]);

	// -------------------- Apply Filters --------------------
	// Applies user-specified filter values to update query states
	function applyFilters(e: FormEvent) {
		e.preventDefault();
		setPage(1);

		setQueryStartDate(enableDateRange ? formStartDate : "");
		setQueryEndDate(enableDateRange ? formEndDate : "");
		setQueryMinValue(enableValueRange ? formMinValue : "");
		setQueryMaxValue(enableValueRange ? formMaxValue : "");
		setQueryBuyerName(enableBuyerName ? formBuyerName : "");
		setQuerySellerName(enableSellerName ? formSellerName : "");

		setShowFilters(false);
	}

	// -------------------- Cancel Filters --------------------
	function cancelFilters() {
		setShowFilters(false);
	}

	// -------------------- Clear All Filters --------------------
	// Resets all filter-related state to default values
	function clearAllFilters() {
		setEnableDateRange(false);
		setEnableValueRange(false);
		setEnableBuyerName(false);
		setEnableSellerName(false);

		setFormStartDate("");
		setFormEndDate("");
		setFormMinValue("");
		setFormMaxValue("");
		setFormBuyerName("");
		setFormSellerName("");

		setQueryStartDate("");
		setQueryEndDate("");
		setQueryMinValue("");
		setQueryMaxValue("");
		setQueryBuyerName("");
		setQuerySellerName("");

		setPage(1);
	}

	// -------------------- Loading / Error UI --------------------
	if (loading) {
		return (
			<div className="flex flex-col justify-center items-center h-screen bg-gray-50">
				<div className="w-16 h-16 mb-4 border-t-4 border-b-4 border-blue-500 rounded-full animate-spin" />
				<div className="animate-pulse flex flex-col items-center">
					<h2 className="text-xl font-semibold text-gray-700 mb-2">
						Loading Transactions
					</h2>
					<p className="text-sm text-gray-600 mb-2">Please wait...</p>
				</div>
			</div>
		);
	}
	if (error) {
		return <div className="text-red-500 p-4 text-center">Error: {error}</div>;
	}

	// -------------------- Render Main App UI --------------------
	return (
		<div className="max-w-7xl mx-auto p-4">
			{/* Top Bar with title and navigation buttons */}
			<div className="flex items-center justify-between mb-8">
				<h1 className="text-3xl font-bold text-gray-800 mr-5">
					BitSlow Transactions
				</h1>
				<div className="flex space-x-2">
					{/* Marketplace button */}
					<button
						type="button"
						onClick={() => {
							window.location.href = "MarketPlace.html";
						}}
						className="bg-purple-500 text-white py-2 px-4 rounded-lg"
					>
						Marketplace
					</button>
					{/* Display Sign Up and Login buttons if not authenticated */}
					{!currentUserId && (
						<>
							<button
								type="button"
								onClick={toggleSignUp}
								className="bg-blue-500 text-white py-2 px-4 rounded-lg"
							>
								Sign Up
							</button>
							<button
								type="button"
								onClick={toggleLogin}
								className="bg-green-500 text-white py-2 px-4 rounded-lg"
							>
								Login
							</button>
						</>
					)}
					{/* Display Profile and Logout buttons if authenticated */}
					{currentUserId && (
						<>
							<button
								type="button"
								onClick={() => {
									window.location.href = `profile.html?userId=${currentUserId}&userName=${currentUserName}`;
								}}
								className="bg-blue-500 text-white py-2 px-4 rounded-lg"
							>
								{currentUserName ? `Hello, ${currentUserName}` : "Profile"}
							</button>
							<button
								type="button"
								onClick={handleLogout}
								className="bg-gray-300 text-black py-2 px-4 rounded-lg"
							>
								Logout
							</button>
						</>
					)}
				</div>
			</div>

			{/* Optional Success Message for Filters */}
			{filtersApplied && (
				<div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
					Filters applied successfully!
				</div>
			)}

			{/* Sign Up Modal */}
			{showSignUp && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
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

			{/* Login Modal */}
			{showLogin && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
					<div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
						<Login
							endpointUrl={ENDPOINT_URL}
							onLoginSuccess={handleLoginSuccess}
							onClose={() => setShowLogin(false)}
							onSwitchToSignUp={() => {
								setShowLogin(false);
								setShowSignUp(true);
							}}
						/>
					</div>
				</div>
			)}

			{/* Filters Button */}
			<div className="mb-4">
				<button
					type="button"
					onClick={() => setShowFilters(!showFilters)}
					className="bg-indigo-500 text-white py-2 px-4 rounded-lg"
				>
					Filters
				</button>
			</div>

			{/* Filters Panel */}
			{showFilters && (
				<form
					onSubmit={applyFilters}
					className="border p-4 rounded-lg mb-4 space-y-4"
				>
					<p className="font-semibold mb-2">Select which filters to enable:</p>

					{/* Date Range */}
					<div>
						<label className="flex items-center space-x-2 mb-1">
							<input
								type="checkbox"
								checked={enableDateRange}
								onChange={(e) => setEnableDateRange(e.target.checked)}
							/>
							<span>Date Range</span>
						</label>
						{enableDateRange && (
							<div className="ml-6 mt-1 space-y-2">
								<div>
									<label
										htmlFor="start-date"
										className="text-sm font-semibold block"
									>
										Start Date
									</label>
									<input
										id="start-date"
										type="date"
										value={formStartDate}
										onChange={(e) => setFormStartDate(e.target.value)}
										className="border rounded px-2 py-1"
									/>
								</div>
								<div>
									<label
										htmlFor="end-date"
										className="text-sm font-semibold block"
									>
										End Date
									</label>
									<input
										id="end-date"
										type="date"
										value={formEndDate}
										onChange={(e) => setFormEndDate(e.target.value)}
										className="border rounded px-2 py-1"
									/>
								</div>
							</div>
						)}
					</div>

					{/* Value Range */}
					<div>
						<label className="flex items-center space-x-2 mb-1">
							<input
								type="checkbox"
								checked={enableValueRange}
								onChange={(e) => setEnableValueRange(e.target.checked)}
							/>
							<span>Value Range</span>
						</label>
						{enableValueRange && (
							<div className="ml-6 mt-1 space-y-2">
								<div>
									<label
										htmlFor="min-value"
										className="text-sm font-semibold block"
									>
										Min Value
									</label>
									<input
										id="min-value"
										type="number"
										value={formMinValue}
										onChange={(e) => setFormMinValue(e.target.value)}
										className="border rounded px-2 py-1"
										placeholder="0"
									/>
								</div>
								<div>
									<label
										htmlFor="max-value"
										className="text-sm font-semibold block"
									>
										Max Value
									</label>
									<input
										id="max-value"
										type="number"
										value={formMaxValue}
										onChange={(e) => setFormMaxValue(e.target.value)}
										className="border rounded px-2 py-1"
										placeholder="999999"
									/>
								</div>
							</div>
						)}
					</div>

					{/* Buyer Name */}
					<div>
						<label className="flex items-center space-x-2 mb-1">
							<input
								type="checkbox"
								checked={enableBuyerName}
								onChange={(e) => setEnableBuyerName(e.target.checked)}
							/>
							<span>Buyer Name</span>
						</label>
						{enableBuyerName && (
							<div className="ml-6 mt-1">
								<label htmlFor="name" className="text-sm font-semibold block">
									Name
								</label>
								<input
									id="name"
									type="text"
									value={formBuyerName}
									onChange={(e) => setFormBuyerName(e.target.value)}
									className="border rounded px-2 py-1"
									placeholder="Alice"
								/>
							</div>
						)}
					</div>

					{/* Seller Name */}
					<div>
						<label className="flex items-center space-x-2 mb-1">
							<input
								type="checkbox"
								checked={enableSellerName}
								onChange={(e) => setEnableSellerName(e.target.checked)}
							/>
							<span>Seller Name</span>
						</label>
						{enableSellerName && (
							<div className="ml-6 mt-1">
								<label htmlFor="name" className="text-sm font-semibold block">
									Name
								</label>
								<input
									id="name"
									type="text"
									value={formSellerName}
									onChange={(e) => setFormSellerName(e.target.value)}
									className="border rounded px-2 py-1"
									placeholder="Bob"
								/>
							</div>
						)}
					</div>

					{/* Buttons */}
					<div className="flex space-x-2 mt-4">
						<button
							type="submit"
							className="bg-blue-500 text-white py-1 px-3 rounded-lg"
						>
							Apply Filters
						</button>
						<button
							type="button"
							onClick={cancelFilters}
							className="bg-gray-300 text-black py-1 px-3 rounded-lg"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={clearAllFilters}
							className="bg-red-500 text-white py-1 px-3 rounded-lg"
						>
							Clear All
						</button>
					</div>

					<p className="text-sm text-gray-500 mt-2">
						Select which filters to enable, fill them in, then press "Apply
						Filters." Or press "Clear All" to remove all filters.
					</p>
				</form>
			)}

			{/* Pagination Controls */}
			<div className="flex items-center mb-2 space-x-4">
				<label htmlFor="limit-select" className="font-semibold">
					Transactions per page:
				</label>
				<select
					id="limit-select"
					value={limit}
					onChange={(e) => {
						setLimit(Number.parseInt(e.target.value, 10));
						setPage(1);
					}}
					className="border rounded px-2 py-1"
				>
					<option value={15}>15</option>
					<option value={30}>30</option>
					<option value={50}>50</option>
				</select>
			</div>
			{/* Pagination Navigation Buttons */}
			<div className="mb-4 flex items-center space-x-2">
				<button
					type="button"
					onClick={() => setPage(Math.max(1, page - 1))}
					disabled={page <= 1}
					className="bg-gray-300 text-black py-1 px-3 rounded-lg disabled:opacity-50"
				>
					Prev
				</button>
				<span>Page {page}</span>
				<button
					type="button"
					onClick={() => setPage(page + 1)}
					disabled={page * limit >= total}
					className="bg-gray-300 text-black py-1 px-3 rounded-lg disabled:opacity-50"
				>
					Next
				</button>
				<span className="ml-2 text-sm text-gray-600">
					(Total: {total} transactions)
				</span>
			</div>

			{/* Transactions Table */}
			{transactions.length === 0 ? (
				<p className="text-gray-500">No transactions found</p>
			) : (
				<div className="overflow-x-auto rounded-lg shadow-md">
					<table className="w-full border-collapse bg-white">
						<thead>
							<tr className="bg-gray-800 text-white">
								<th className="p-4 text-left">ID</th>
								<th className="p-4 text-left">BitSlow</th>
								<th className="p-4 text-left">Seller</th>
								<th className="p-4 text-left">Buyer</th>
								<th className="p-4 text-right">Amount</th>
								<th className="p-4 text-left">Date</th>
							</tr>
						</thead>
						<tbody>
							{transactions.map((tx, index) => (
								<tr
									key={tx.id}
									className={`hover:bg-gray-50 transition-colors ${
										index === transactions.length - 1
											? ""
											: "border-b border-gray-200"
									}`}
								>
									<td className="p-4 text-gray-600">{tx.id}</td>
									<td className="p-4">
										<div>
											<div className="font-medium text-gray-800">
												{tx.computedBitSlow}
											</div>
											<div className="text-xs text-gray-500 mt-1">
												Bits: {tx.bit1}, {tx.bit2}, {tx.bit3}
											</div>
											<div className="text-xs text-gray-500">
												Value: ${tx.value.toLocaleString()}
											</div>
										</div>
									</td>
									<td className="p-4 text-gray-700">
										{tx.seller_name ? tx.seller_name : "Original Issuer"}
									</td>
									<td className="p-4 text-gray-700">{tx.buyer_name}</td>
									<td className="p-4 text-right font-semibold text-gray-800">
										${tx.amount.toLocaleString()}
									</td>
									<td className="p-4 text-sm text-gray-600">
										{new Date(tx.transaction_date).toLocaleString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

export default App;
