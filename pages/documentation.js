import React from 'react';

export default function Documentation() {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center">
      <header className="bg-white w-full shadow-md p-4">
        <h1 className="text-4xl font-bold text-gray-800 text-center">Documentation</h1>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto mt-6">
        <section className="bg-yellow-100 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl text-yellow-800 font-semibold">Getting Started</h2>
          <p className="mt-2 text-gray-700">Follow these steps to get started with Soul Safety:</p>
          <ol className="list-decimal list-inside mt-2 text-gray-600">
            <li>Fork the repository from GitHub.</li>
            <li>Clone the forked repo to your local development environment.</li>
            <li>Run <code>npm install</code> to set up dependencies.</li>
          </ol>
        </section>

        <section className="bg-green-100 mt-8 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl text-green-800 font-semibold">Deployment</h2>
          <p className="mt-2 text-gray-700">Check back later for simplified deployment plans and live integration tips.</p>
        </section>
      </main>

      <footer className="bg-gray-800 text-gray-200 w-full py-4 text-center">
        <p>&copy; 2026 Soul Safety. Your safety in open source, redefined.</p>
      </footer>
    </div>
  );
}