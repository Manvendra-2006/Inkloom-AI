// frontend/src/pages/GuidelinesPage.js
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MainLayout from '../layouts/MainLayout';

export default function GuidelinesPage() {
  const [guidelines, setGuidelines] = useState([]);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchGuidelines = async () => {
    try {
      const res = await api.get('/admin/guidelines');
      setGuidelines(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGuidelines();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/admin/guidelines/${editingId}`, form);
      } else {
        await api.post('/admin/guidelines', form);
      }
      setForm({});
      setEditingId(null);
      fetchGuidelines();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const startEdit = (g) => {
    setEditingId(g._id);
    setForm({
      category: g.category,
      title: g.title,
      description: g.description,
      rule: g.rule,
      examples: g.examples,
      severity: g.severity,
      active: g.active,
    });
  };

  const handleDelete = async (id) => {
    await api.delete(`/admin/guidelines/${id}`);
    fetchGuidelines();
  };

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Brand Guidelines</h1>
      {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
      {/* List */}
      <table className="min-w-full bg-white shadow rounded mb-6">
        <thead>
          <tr>
            <th className="px-4 py-2 border">Category</th>
            <th className="px-4 py-2 border">Title</th>
            <th className="px-4 py-2 border">Active</th>
            <th className="px-4 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {guidelines.map((g) => (
            <tr key={g._id} className="hover:bg-gray-100">
              <td className="px-4 py-2 border">{g.category}</td>
              <td className="px-4 py-2 border">{g.title}</td>
              <td className="px-4 py-2 border">{g.active ? 'Yes' : 'No'}</td>
              <td className="px-4 py-2 border space-x-2">
                <button
                  onClick={() => startEdit(g)}
                  className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(g._id)}
                  className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <label className="block font-medium mb-1">Category</label>
          <select
            name="category"
            value={form.category || ''}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select...</option>
            <option value="TONE">TONE</option>
            <option value="TERMINOLOGY">TERMINOLOGY</option>
            <option value="FACTS">FACTS</option>
            <option value="CLAIMS">CLAIMS</option>
            <option value="MESSAGING">MESSAGING</option>
            <option value="RESTRICTED_WORDS">RESTRICTED_WORDS</option>
            <option value="BRANDING">BRANDING</option>
            <option value="ACCESSIBILITY">ACCESSIBILITY</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Title</label>
          <input
            name="title"
            value={form.title || ''}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={form.description || ''}
            onChange={handleChange}
            rows={2}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Rule</label>
          <textarea
            name="rule"
            value={form.rule || ''}
            onChange={handleChange}
            rows={2}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Severity</label>
          <select
            name="severity"
            value={form.severity || ''}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select...</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
        <div className="flex items-center mt-6">
          <input
            type="checkbox"
            name="active"
            checked={form.active || false}
            onChange={handleChange}
            className="mr-2"
          />
          <label className="font-medium">Active</label>
        </div>
        <div className="col-span-2">
          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            {editingId ? 'Update Guideline' : 'Add Guideline'}
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
