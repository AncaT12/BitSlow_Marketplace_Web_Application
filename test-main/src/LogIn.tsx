import { useState } from "react";
import type { FormEvent } from "react";

// Define the props that the Login component will accept
interface LoginProps {
	endpointUrl: string;
	onLoginSuccess: (userId: number, userName: string) => void; // Callback to notify the parent that the user is logged in.
	onClose: () => void;
	// Function to switch to the Sign Up view/modal
	onSwitchToSignUp: () => void;
}

export function Login({
	endpointUrl,
	onLoginSuccess,
	onClose,
	onSwitchToSignUp,
}: LoginProps) {
	// Local state for email, password, and any error messages
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	// Function to handle form submission for login
	const handleSubmit = async (e: FormEvent) => {
		// Prevent the default form submission behavior
		e.preventDefault();

		if (!email || !password) {
			setError("Please enter email and password.");
			return;
		}
		try {
			// Send a POST request to the login API with the email and password
			const response = await fetch(`${endpointUrl}api/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			// Parse the response as JSON
			const data = await response.json();

			// If the response is not OK, set an error message and exit the function early
			if (!response.ok) {
				setError(data.message || "Login failed.");
				return; // exit the function early
			}

			// Call the onLoginSuccess callback with the returned userId and userName
			onLoginSuccess(data.userId, data.userName);
			onClose();
		} catch (err) {
			// If an error occurs during fetch, update the error state accordingly
			setError(err instanceof Error ? err.message : "Login failed.");
		}
	};

	return (
		<div>
			<h2 className="text-2xl font-bold mb-4">Login</h2>
			{/* Display any error messages */}
			{error && <p className="text-red-500 mb-4">{error}</p>}
			{/* Login form */}
			<form onSubmit={handleSubmit}>
				{/* Email field */}
				<label className="block mb-2">
					Email:
					<input
						type="email"
						className="border p-2 w-full"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
				</label>
				{/* Password field */}
				<label className="block mb-2">
					Password:
					<input
						type="password"
						className="border p-2 w-full"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</label>
				{/* Submit button for the form */}
				<button
					type="submit"
					className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
				>
					Login
				</button>
				{/* Button to cancel login and close the modal */}
				<button
					type="button"
					onClick={() => onClose()}
					className="mt-4 bg-gray-300 text-black py-2 px-4 rounded hover:bg-gray-400"
				>
					Cancel
				</button>
			</form>
			{/* Text with a button to switch to the Sign Up view */}
			<p className="text-center text-sm mt-4">
				Don't have an account?{" "}
				<button
					type="button"
					onClick={onSwitchToSignUp}
					className="text-blue-500 underline"
				>
					Sign Up
				</button>
			</p>
		</div>
	);
}
