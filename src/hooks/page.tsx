export default function SavedLooksPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Saved Looks</h1>
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md text-center">
        <p className="text-gray-600">
          No saved looks yet. Capture and personalize your style to save them here!
        </p>
        {/* Future: Display a grid of saved beauty cards */}
      </div>
    </div>
  );
}
