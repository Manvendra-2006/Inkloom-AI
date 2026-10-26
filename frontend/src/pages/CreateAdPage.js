// frontend/src/pages/CreateAdPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

export default function CreateAdPage() {
  const [form, setForm] = useState({ title: '', caption: '', imageUrl: '' });
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/ads', form);
      navigate(`/employee/ad/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create advertisement');
    }
  };

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Create Advertisement</h1>
      {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block font-medium mb-1">Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Caption / Content</label>
          <textarea
            name="caption"
            value={form.caption}
            onChange={handleChange}
            rows={4}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Image URL</label>
          <input
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
            placeholder="https://..."
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
        >
          Save Draft
        </button>
      </form>
    </MainLayout>
  );
}
