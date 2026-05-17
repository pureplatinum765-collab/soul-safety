import React from 'react';

export default function Values() {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center">
      <header className="bg-white w-full shadow-md p-4">
        <h1 className="text-4xl font-bold text-gray-800 text-center">Our Values</h1>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto mt-6">
        <section className="bg-indigo-100 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl text-indigo-800 font-semibold">Integrity</h2>
          <p className="mt-2 text-gray-700">We believe in creating tools and systems that are reliable, transparent, and impactful.</p>
        </section>

        <section className="bg-purple-100 mt-8 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl text-purple-800 font-semibold">Collaboration</h2>
          <p className="mt-2 text-gray-700">Strong moral principles are the foundation of our work. With every line of code, we aim to build connections.</p>
        </section>
      </main>

      <footer className="bg-gray-800 text-gray-200 w-full py-4 text-center">
        <p>&copy; 2026 Soul Safety. Created to uphold strong values in open source development.</p>
      </footer>
    </div>
  );
}