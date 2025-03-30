import { useState } from "react";
import type { FormEvent } from "react";

// The expected props for the SignUp component.
interface SignUpProps {
	onClose: () => void;
	endpointUrl: string;
	// Function to switch from SignUp to Login mode.
	onSwitchToLogin: () => void;
}
export function SignUp({ onClose, endpointUrl, onSwitchToLogin }: SignUpProps) {
	// Define state variables for form fields.
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [phone, setPhone] = useState("");
	const [address, setAddress] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	// Helper function to validate email format using a regex.
	const validateEmail = (email: string) => {
		const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return regex.test(email);
	};

	// Handle form submission.
	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();

		// Basic validation: check if required fields are filled.
		if (!name || !email || !password) {
			setError("Please fill in all required fields.");
			return;
		}

		if (!validateEmail(email)) {
			setError("Please enter a valid email address.");
			return;
		}

		// Ensure the password meets a minimum length requirement.
		if (password.length < 8) {
			setError("Password must be at least 8 characters long.");
			return;
		}

		try {
			// Send a POST request to the registration API.
			const response = await fetch(`${endpointUrl}api/register`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				// Include the form data in the request body.
				body: JSON.stringify({ name, email, password, phone, address }),
			});

			// Parse the JSON response.
			const responseData = await response.json();

			if (!response.ok) {
				setError(responseData.message || "Registration failed.");
				setSuccess(false);
				return;
			}

			// If registration was successful, update success state.
			setSuccess(true);
			setError(null);

			// Close the modal after a short delay.
			setTimeout(() => {
				onClose(); // Close the modal after successful registration
			}, 2000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Registration failed.");
		}
	};

	return (
		<div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
			{/* Header for the Sign-Up modal */}
			<h2 className="text-2xl font-bold mb-6 text-gray-800">Sign Up</h2>
			{error && <p className="text-red-500 mb-4">{error}</p>}
			{/* Display success message if registration is successful */}
			{success && (
				<p className="text-green-500 mb-4">
					Registration successful! You can now log in.
				</p>
			)}
			{/* Sign Up form */}
			<form onSubmit={handleSubmit}>
				{/* Name field */}
				<div className="mb-4">
					<label
						htmlFor="name"
						className="block text-gray-700 text-sm font-bold mb-2"
					>
						Name
					</label>
					<input
						id="name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						required
					/>
				</div>
				{/* Email field */}
				<div className="mb-4">
					<label
						htmlFor="name"
						className="block text-gray-700 text-sm font-bold mb-2"
					>
						Email
					</label>
					<input
						id="name"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						required
					/>
				</div>
				{/* Password field */}
				<div className="mb-4">
					<label
						htmlFor="name"
						className="block text-gray-700 text-sm font-bold mb-2"
					>
						Password
					</label>
					<input
						id="name"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						required
					/>
				</div>
				{/* Phone field (optional) */}
				<div className="mb-4">
					<label
						htmlFor="name"
						className="block text-gray-700 text-sm font-bold mb-2"
					>
						Phone (optional)
					</label>
					<input
						id="name"
						type="tel"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
						className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				{/* Address field (optional) */}
				<div className="mb-6">
					<label
						htmlFor="name"
						className="block text-gray-700 text-sm font-bold mb-2"
					>
						Address (optional)
					</label>
					<input
						id="name"
						type="text"
						value={address}
						onChange={(e) => setAddress(e.target.value)}
						className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				{/* Submit button for registration */}
				<button
					type="submit"
					className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					Sign Up
				</button>
				{/* Cancel button to close the modal */}
				<button
					type="button"
					onClick={() => onClose()}
					className="mt-4 bg-gray-300 text-black py-2 px-4 rounded hover:bg-gray-400"
				>
					Cancel
				</button>
			</form>
			{/* Option to switch to the Login modal */}
			<p className="text-center text-sm mt-4">
				Already have an account?{" "}
				<button
					type="button"
					onClick={onSwitchToLogin}
					className="text-blue-500 underline"
				>
					Log In
				</button>
			</p>
		</div>
	);
}
