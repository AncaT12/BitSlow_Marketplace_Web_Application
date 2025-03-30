import { serve } from "bun";
import { Database } from "bun:sqlite";
import { seedDatabase } from "./seed";
import { computeBitSlow } from "./bitslow";
import bcrypt from "bcryptjs"; // Add bcrypt for password hashing
// Load the main HTML file to serve as the default page
const indexFile = Bun.file("src/index.html");

//  Initialize the in-memory SQLite database
const db = new Database(":memory:");

// Seed the database with random data
seedDatabase(db, {
	clientCount: 20,
	bitSlowCount: 50,
	transactionCount: 100,
	clearExisting: true,
});
// Interface for a coin row (matching the database schema)
interface CoinRow {
	coin_id: number;
	value: number;
	bit1: number;
	bit2: number;
	bit3: number;
	client_id: number | null;
}

console.log("✅ Database initialized!");

// Define type for route handlers: mapping route string keys to a function
// that receives a Request and returns a Promise<Response>
type RouteHandlers = {
	[key: string]:
		| ((req: Request) => Promise<Response>)
		| (() => Promise<Response>);
};

// Start Bun server and define its behavior via the fetch() handler
const server = serve({
	async fetch(req, server) {
		const url = new URL(req.url);

		// Allow WebSockets for Hot Module Replacement (HMR)
		if (url.pathname.startsWith("/_bun/hmr")) {
			if (server.upgrade(req)) return;
			return new Response(null, { status: 101 });
		}

		// Define routes with an explicit type
		const routes: RouteHandlers = {
			// Registration endpoint: Handles user registration via POST
			"/api/register": async (req) => {
				if (req.method === "POST") {
					try {
						// Parse the JSON body with registration details
						const { name, email, password, phone, address } = await req.json();

						// Check if the email already exists in the clients table
						const existingUser = db
							.query("SELECT * FROM clients WHERE email = ?")
							.get(email);
						if (existingUser) {
							return new Response(
								JSON.stringify({ message: "Email already exists." }),
								{
									status: 400,
									headers: {
										"Content-Type": "application/json",
										"Access-Control-Allow-Origin": "*",
									},
								},
							);
						}

						// Hash password using bcrypt with a salt of 10 rounds
						const hashedPassword = await bcrypt.hash(password, 10);

						// Insert new client into the database
						db.query(
							"INSERT INTO clients (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)",
						).run(name, email, hashedPassword, phone, address);

						return new Response(
							JSON.stringify({ message: "Registration successful." }),
							{
								status: 201,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					} catch (error) {
						console.error("Error during registration:", error);
						return new Response(
							JSON.stringify({ message: "Registration failed." }),
							{
								status: 500,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}
				} else {
					return new Response("Method Not Allowed", { status: 405 });
				}
			},

			// Transactions endpoint: Returns a list of transactions with optional filters and pagination
			"/api/transactions": async (req) => {
				try {
					const url = new URL(req.url);
					// Parse pagination parameters from the URL
					const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
					const limit = Number.parseInt(
						url.searchParams.get("limit") || "15",
						10,
					);
					const offset = (page - 1) * limit;

					// Build filter clauses based on query parameters
					const whereClauses: string[] = [];
					const params: (string | number)[] = [];
					const startDate = url.searchParams.get("startDate");
					const endDate = url.searchParams.get("endDate");
					const minValue = url.searchParams.get("minValue");
					const maxValue = url.searchParams.get("maxValue");
					const buyerName = url.searchParams.get("buyerName");
					const sellerName = url.searchParams.get("sellerName");

					if (startDate) {
						whereClauses.push("t.transaction_date >= ?");
						params.push(startDate);
					}
					if (endDate) {
						whereClauses.push("t.transaction_date <= ?");
						params.push(endDate);
					}
					if (minValue) {
						whereClauses.push("c.value >= ?");
						params.push(minValue);
					}
					if (maxValue) {
						whereClauses.push("c.value <= ?");
						params.push(maxValue);
					}
					if (buyerName) {
						whereClauses.push("buyer.name LIKE ?");
						params.push(`%${buyerName}%`);
					}
					if (sellerName) {
						whereClauses.push("seller.name LIKE ?");
						params.push(`%${sellerName}%`);
					}

					// If there are any filters, build the WHERE clause; otherwise leave it empty
					const whereSql =
						whereClauses.length > 0
							? `WHERE ${whereClauses.join(" AND ")}`
							: "";

					// Construct the SQL query for selecting transactions
					const selectQuery = `
      SELECT 
        t.id, 
        t.coin_id, 
        t.amount, 
        t.transaction_date,
        seller.id as seller_id,
        seller.name as seller_name,
        buyer.id as buyer_id,
        buyer.name as buyer_name,
        c.bit1,
        c.bit2,
        c.bit3,
        c.value
      FROM transactions t
      LEFT JOIN clients seller ON t.seller_id = seller.id
      JOIN clients buyer ON t.buyer_id = buyer.id
      JOIN coins c ON t.coin_id = c.coin_id
      ${whereSql}
      ORDER BY t.transaction_date DESC
      LIMIT ? OFFSET ?
    `;
					// Append pagination values to the parameters array
					const selectParams = [...params, limit, offset];

					// Execute the SQL query for transactions
					const rawTransactions = db
						.query(selectQuery)
						.all(...selectParams) as Array<{
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
					}>;

					// SQL query to count the total number of transactions matching the filters
					const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      LEFT JOIN clients seller ON t.seller_id = seller.id
      JOIN clients buyer ON t.buyer_id = buyer.id
      JOIN coins c ON t.coin_id = c.coin_id
      ${whereSql}
    `;
					const countResult = db.query(countQuery).get(...params) as
						| { total: number }
						| undefined;
					const total = countResult ? countResult.total : 0;

					// Enhance each transaction with a computed BitSlow value
					const enhancedTransactions = rawTransactions.map((tx) => ({
						...tx,
						computedBitSlow: computeBitSlow(tx.bit1, tx.bit2, tx.bit3),
					}));

					// Return the JSON response with transactions data and pagination details
					return new Response(
						JSON.stringify({
							transactions: enhancedTransactions,
							total,
							page,
							limit,
						}),
						{
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						},
					);
				} catch (error) {
					console.error("Error fetching transactions:", error);
					const errorMessage =
						error instanceof Error
							? error.message
							: "Error fetching transactions";
					return new Response(JSON.stringify({ message: errorMessage }), {
						status: 500,
					});
				}
			},

			// Login endpoint: Handles user login
			"/api/login": async (req) => {
				if (req.method === "POST") {
					try {
						const { email, password } = await req.json();
						// Query for the user by email
						const user = db
							.query("SELECT * FROM clients WHERE email = ?")
							.get(email) as
							| {
									id: number;
									name: string;
									email: string;
									password: string;
									phone: string | null;
									address: string | null;
							  }
							| undefined;

						if (!user) {
							return new Response(
								JSON.stringify({ message: "User not found." }),
								{
									status: 404,
									headers: {
										"Content-Type": "application/json",
										"Access-Control-Allow-Origin": "*",
									},
								},
							);
						}

						// Compare the provided password with the stored hashed password
						const isMatch = await bcrypt.compare(password, user.password);
						if (!isMatch) {
							return new Response(
								JSON.stringify({ message: "Incorrect password." }),
								{
									status: 401,
									headers: {
										"Content-Type": "application/json",
										"Access-Control-Allow-Origin": "*",
									},
								},
							);
						}

						// Successful login: return userId and userName in the response
						return new Response(
							JSON.stringify({
								message: "Login successful.",
								userId: user.id,
								userName: user.name,
							}),
							{
								status: 200,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					} catch (error) {
						console.error("Error during login:", error);
						return new Response(JSON.stringify({ message: "Login failed." }), {
							status: 500,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						});
					}
				} else {
					return new Response("Method Not Allowed", { status: 405 });
				}
			},

			// Profile endpoint: Returns profile data including total transactions and coins owned
			"/api/profile": async (req) => {
				try {
					const url = new URL(req.url);
					const userId = url.searchParams.get("userId");
					if (!userId) {
						return new Response(
							JSON.stringify({ message: "Missing userId parameter." }),
							{
								status: 400,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}

					// Query to count the total number of transactions for the user (as buyer or seller).
					const totalTransactionsQuery = db
						.query(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE buyer_id = ? OR seller_id = ?
      `)
						.get(userId, userId) as { count: number } | undefined;

					if (!totalTransactionsQuery) {
						return new Response(
							JSON.stringify({ message: "No transactions found." }),
							{
								status: 404,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}
					const totalTransactions = totalTransactionsQuery.count;

					// Query for coins owned by the user (from the latest transaction per coin)
					const userCoinsQuery = db
						.query(`
        SELECT c.coin_id, c.value, c.bit1, c.bit2, c.bit3
        FROM coins c
        JOIN transactions t ON c.coin_id = t.coin_id
        WHERE t.id = (
          SELECT MAX(id) FROM transactions t2 
          WHERE t2.coin_id = c.coin_id
        )
        AND t.buyer_id = ?
      `)
						.all(userId) as Array<{
						coin_id: number;
						value: number;
						bit1: number;
						bit2: number;
						bit3: number;
					}>;

					const totalBitSlow = userCoinsQuery.length;
					let totalValue = 0;
					// Use a for...of loop instead of forEach for performance
					for (const coin of userCoinsQuery) {
						totalValue += coin.value;
					}

					const profileData = {
						totalTransactions,
						totalBitSlow,
						totalValue,
					};
					return new Response(JSON.stringify(profileData), {
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				} catch (error) {
					console.error("Error in /api/profile:", error);
					return new Response(
						JSON.stringify({ message: "Error fetching profile data" }),
						{ status: 500 },
					);
				}
			},

			// Coins endpoint: Returns a paginated list of coins
			"/api/coins": async (req) => {
				try {
					const url = new URL(req.url);
					const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
					const limit = Number.parseInt(
						url.searchParams.get("limit") || "30",
						10,
					);
					const offset = (page - 1) * limit;

					// Query for coins along with the current owner name (if any)
					const rows = db
						.query(`
						SELECT
							c.coin_id,
							c.value,
							c.bit1,
							c.bit2,
							c.bit3,
							c.client_id,
							(
								SELECT buyer.name
								FROM transactions t
										 JOIN clients buyer ON t.buyer_id = buyer.id
								WHERE t.coin_id = c.coin_id
								ORDER BY t.transaction_date DESC
								LIMIT 1
							) AS owner_name
						FROM coins c
						ORDER BY c.coin_id ASC
							LIMIT ? OFFSET ?
					`)
						.all(limit, offset) as Array<{
						coin_id: number;
						value: number;
						bit1: number;
						bit2: number;
						bit3: number;
						client_id: number | null;
						owner_name: string | null;
					}>;

					// Dynamically import computeBitSlow function for each coin
					const { computeBitSlow } = await import("./bitslow");

					const coins = rows.map((coin) => ({
						...coin,
						computedBitSlow: computeBitSlow(coin.bit1, coin.bit2, coin.bit3),
					}));

					const count = db
						.query("SELECT COUNT(*) as total FROM coins")
						.get() as { total: number };

					return new Response(
						JSON.stringify({ coins, total: count.total, page, limit }),
						{
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						},
					);
				} catch (error) {
					console.error("Error fetching coins:", error);
					return new Response(
						JSON.stringify({ message: "Error fetching coins" }),
						{ status: 500 },
					);
				}
			},

			// Buy endpoint: Allows a user to buy a coin if it's not already owned
			"/api/buy": async (req) => {
				if (req.method !== "POST") {
					return new Response("Method Not Allowed", { status: 405 });
				}
				try {
					const { coin_id, buyer_id } = await req.json();

					// Find the coin by coin_id
					const coin = db
						.query("SELECT * FROM coins WHERE coin_id = ?")
						.get(coin_id) as CoinRow | undefined;
					if (!coin) {
						return new Response(JSON.stringify({ message: "Coin not found" }), {
							status: 404,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						});
					}

					// If the coin already belongs to the current buyer, it cannot be purchased again.
					if (coin.client_id && coin.client_id === buyer_id) {
						return new Response(
							JSON.stringify({ message: "This coin is already yours" }),
							{
								status: 400,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}

					// Save the current owner (seller), which can be null if the coin has never been purchased.
					const seller_id = coin.client_id || null;
					// Update the coin with the new buyer_id (the last buyer becomes the owner).
					db.query("UPDATE coins SET client_id = ? WHERE coin_id = ?").run(
						buyer_id,
						coin_id,
					);

					// Insert a new transaction with the same price and the current date.
					const amount = coin.value;
					const transaction_date = new Date().toISOString();
					db.query(
						`
							INSERT INTO transactions (coin_id, amount, transaction_date, seller_id, buyer_id)
							VALUES (?, ?, ?, ?, ?)
						`,
					).run(coin_id, amount, transaction_date, seller_id, buyer_id);

					return new Response(
						JSON.stringify({ message: "Coin purchased successfully" }),
						{
							status: 200,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						},
					);
				} catch (error) {
					console.error("Error buying coin:", error);
					return new Response(
						JSON.stringify({ message: "Error buying coin" }),
						{ status: 500 },
					);
				}
			},

			// Generate Coin endpoint: Generates a new coin with a unique combination of bits
			"/api/generate-coin": async (req) => {
				if (req.method !== "POST") {
					return new Response("Method Not Allowed", { status: 405 });
				}
				try {
					const { amount } = await req.json();

					// Get all used bit combinations
					const used = db
						.query("SELECT bit1, bit2, bit3 FROM coins")
						.all() as Array<{ bit1: number; bit2: number; bit3: number }>;

					// Function to check if a given combination is already used
					function isUsed(b1: number, b2: number, b3: number): boolean {
						return used.some(
							(c) => c.bit1 === b1 && c.bit2 === b2 && c.bit3 === b3,
						);
					}

					let attempts = 0;
					let bit1 = 0;
					let bit2 = 0;
					let bit3 = 0;
					do {
						// Generate random bit values between 1 and 100
						bit1 = Math.floor(Math.random() * 100) + 1;
						bit2 = Math.floor(Math.random() * 100) + 1;
						bit3 = Math.floor(Math.random() * 100) + 1;
						attempts++;
						if (attempts > 10000) break; // avoid infinite loop if no unique combination is found
					} while (isUsed(bit1, bit2, bit3));

					if (attempts > 10000) {
						return new Response(
							JSON.stringify({ message: "No unique combinations remaining" }),
							{
								status: 400,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}

					// Insert the new coin with client_id set to NULL (unowned)
					db.query(`
      INSERT INTO coins (value, bit1, bit2, bit3, client_id)
      VALUES (?, ?, ?, ?, NULL)
    `).run(amount, bit1, bit2, bit3);

					return new Response(
						JSON.stringify({ message: "Coin generated successfully" }),
						{
							status: 201,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						},
					);
				} catch (error) {
					console.error("Error generating coin:", error);
					return new Response(
						JSON.stringify({ message: "Error generating coin" }),
						{ status: 500 },
					);
				}
			},

			// Coin History endpoint: Returns the transaction history for a specific coin
			"/api/coin-history": async (req) => {
				if (req.method !== "GET") {
					return new Response("Method Not Allowed", { status: 405 });
				}
				try {
					const url = new URL(req.url);
					const coin_id = url.searchParams.get("coin_id");
					if (!coin_id) {
						return new Response(
							JSON.stringify({ message: "Missing coin_id parameter" }),
							{
								status: 400,
								headers: {
									"Content-Type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}
					const history = db
						.query(
							`
      SELECT 
        t.id, 
        t.coin_id, 
        t.transaction_date, 
        seller.name as seller_name, 
        buyer.name as buyer_name
      FROM transactions t
      LEFT JOIN clients seller ON t.seller_id = seller.id
      JOIN clients buyer ON t.buyer_id = buyer.id
      WHERE t.coin_id = ?
      ORDER BY t.transaction_date ASC
    `,
						)
						.all(coin_id) as Array<{
						id: number;
						coin_id: number;
						transaction_date: string;
						seller_name: string | null;
						buyer_name: string;
					}>;
					return new Response(JSON.stringify({ history }), {
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				} catch (error) {
					console.error("Error fetching coin history:", error);
					return new Response(
						JSON.stringify({ message: "Error fetching coin history" }),
						{ status: 500 },
					);
				}
			},
		};

		// Dynamic Route Handling: If the request URL matches a defined route,
		// call the corresponding route handler.
		const routeHandler = routes[url.pathname as keyof typeof routes];
		if (routeHandler) return routeHandler(req);

		// If no API route matches, handle frontend/asset requests:
		// Build and serve frontend TypeScript files for browser targets
		if (url.pathname === "/frontend.tsx" && req.method === "GET") {
			const result = await Bun.build({
				entrypoints: [`${import.meta.dir}/frontend.tsx`],
				target: "browser",
			});
			const js = await result.outputs[0].text();

			return new Response(js, {
				headers: {
					"Content-Type": "application/javascript",
				},
			});
		}
		if (url.pathname === "/Profile.tsx" && req.method === "GET") {
			const result = await Bun.build({
				entrypoints: [`${import.meta.dir}/profile.tsx`],
				target: "browser",
			});
			const js = await result.outputs[0].text();

			return new Response(js, {
				headers: {
					"Content-Type": "application/javascript",
				},
			});
		}
		if (url.pathname === "/MarketPlace.tsx" && req.method === "GET") {
			const result = await Bun.build({
				entrypoints: [`${import.meta.dir}/MarketPlace.tsx`],
				target: "browser",
			});
			const js = await result.outputs[0].text();

			return new Response(js, {
				headers: {
					"Content-Type": "application/javascript",
				},
			});
		}

		// Serve static files (CSS, SVG, etc.)
		if (req.method === "GET") {
			const staticFilePath = import.meta.dir + url.pathname;
			const staticFile = Bun.file(staticFilePath);

			if (await staticFile.exists()) {
				const ext = url.pathname.split(".").pop();
				const types: Record<string, string> = {
					html: "text/html",
					js: "application/javascript",
					tsx: "application/javascript",
					css: "text/css",
					svg: "image/svg+xml",
					png: "image/png",
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					ico: "image/x-icon",
				};

				return new Response(staticFile, {
					headers: {
						"Content-Type": types[ext || ""] || "application/octet-stream",
					},
				});
			}
		}

		//Default fallback: Serve the main index.html page for GET requests
		if (req.method === "GET") {
			return new Response(await indexFile.text(), {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		}

		// If no routes match, return 404 Not Found
		return new Response("Not Found", { status: 404 });
	},

	// WebSocket Handling: Provide a handler for incoming WebSocket messages.
	websocket: {
		message(_ws, message) {
			console.log("Received WebSocket message:", message);
		},
	},

	// Set development mode based on the NODE_ENV environment variable
	development: process.env.NODE_ENV !== "production",
});

console.log("🚀 Server running at", server.url);
