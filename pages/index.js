import React from 'react';

export default function Home() {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center">
      <header className="bg-white w-full shadow-md p-4">
        <h1 className="text-4xl font-bold text-gray-800 text-center">Soul Safety</h1>
        <p className="text-gray-600 text-center mt-2">Collaboration that restores safety to the soul of codebase workflows.</p>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto mt-6">
        <section className="bg-teal-100 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl text-teal-800 font-semibold">Our Mission</h2>
          <p className="mt-2 text-gray-700">To create a collaborative space where developers can ensure the safety, integrity, and reliability of their codebases.</p>
          <button className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg shadow-md hover:bg-teal-600">Learn More</button>
        </section>

        <section className="mt-8">
          <h2 className="text-xl text-gray-800 font-semibold">GitHub Stats</h2>
          <p className="mt-2 text-gray-600">Live integration with GitHub data coming soon!</p>
        </section>
      </main>

      <footer className="bg-gray-800 text-gray-200 w-full py-4 text-center">
        <p>&copy; 2026 Soul Safety. Designed with simplicity and love.</p>
      </footer>
    </div>
  );
}