// frontend/src/pages/LoginPage.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ---------- Constants ---------- */

const HOME_BY_ROLE = {
  ADMIN: '/admin/dashboard',
  EMPLOYEE: '/employee/dashboard',
};

const INPUT_CLASS =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';

/* ---------- Components ---------- */

function Field({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ---------- Page ---------- */

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Demo login states
  const [demoSubmitting, setDemoSubmitting] = useState({ employee: false, admin: false });
  const [demoError, setDemoError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(HOME_BY_ROLE[user.role] || HOME_BY_ROLE.EMPLOYEE);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (role) => {
    const envPrefix = role === 'employee' ? 'DEMO_EMPLOYEE' : 'DEMO_ADMIN';
    const demoEmail = process.env[`REACT_APP_${envPrefix}_EMAIL`];
    const demoPassword = process.env[`REACT_APP_${envPrefix}_PASSWORD`];
    if (!demoEmail || !demoPassword) {
      setDemoError('Demo credentials are not configured.');
      return;
    }
    setDemoError(null);
    setDemoSubmitting((prev) => ({ ...prev, [role]: true }));
    try {
      const user = await login(demoEmail, demoPassword);
      navigate(HOME_BY_ROLE[user.role] || HOME_BY_ROLE.EMPLOYEE);
    } catch (err) {
      setDemoError('Demo login failed. Please try again.');
    } finally {
      setDemoSubmitting((prev) => ({ ...prev, [role]: false }));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">INKLOOM AI – Login</h1>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field id="email" label="Email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </Field>

          <Field id="password" label="Password">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-indigo-600 py-2 font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          No account?{' '}
          <Link to="/register" className="text-indigo-600 hover:underline">
            Register here
          </Link>
        </p>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <hr className="flex-1 border-t border-gray-300" />
          <span className="mx-2 text-gray-500">or</span>
          <hr className="flex-1 border-t border-gray-300" />
        </div>

        {/* Demo Login Section */}
        {demoError && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {demoError}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleDemoLogin('employee')}
            disabled={demoSubmitting.employee}
            className="w-full flex items-center justify-center rounded bg-green-600 py-2 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {demoSubmitting.employee ? 'Logging in as Employee...' : '👤 Login with Demo Employee'}
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin('admin')}
            disabled={demoSubmitting.admin}
            className="w-full flex items-center justify-center rounded bg-yellow-600 py-2 font-medium text-white transition hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {demoSubmitting.admin ? 'Logging in as Admin...' : '🛡️ Login with Demo Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}


// import { Link, useNavigate } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';

// /* ---------- Constants ---------- */

// const HOME_BY_ROLE = {
//   ADMIN: '/admin/dashboard',
//   EMPLOYEE: '/employee/dashboard',
// };

// const INPUT_CLASS =
//   'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';

// /* ---------- Components ---------- */

// function Field({ id, label, children }) {
//   return (
//     <div>
//       <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800">
//         {label}
//       </label>
//       {children}
//     </div>
//   );
// }

// /* ---------- Page ---------- */

// export default function LoginPage() {
//   const { login } = useAuth();
//   const navigate = useNavigate();

//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [error, setError] = useState(null);
//   const [submitting, setSubmitting] = useState(false);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError(null);
//     setSubmitting(true);
//     try {
//       const user = await login(email, password);
//       navigate(HOME_BY_ROLE[user.role] || HOME_BY_ROLE.EMPLOYEE);
//     } catch (err) {
//       setError(err.response?.data?.message || 'Login failed');
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
//       <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
//         <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">INKLOOM AI – Login</h1>

//         {error && (
//           <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
//             {error}
//           </div>
//         )}

//         <form onSubmit={handleSubmit} className="space-y-4">
//           <Field id="email" label="Email">
//             <input
//               id="email"
//               type="email"
//               autoComplete="email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//               className={INPUT_CLASS}
//             />
//           </Field>

//           <Field id="password" label="Password">
//             <input
//               id="password"
//               type="password"
//               autoComplete="current-password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//               className={INPUT_CLASS}
//             />
//           </Field>

//           <button
//             type="submit"
//             disabled={submitting}
//             className="w-full rounded bg-indigo-600 py-2 font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
//           >
//             {submitting ? 'Logging in...' : 'Log in'}
//           </button>
//         </form>

//         <p className="mt-4 text-center text-sm text-gray-600">
//           No account?{' '}
//           <Link to="/register" className="text-indigo-600 hover:underline">
//             Register here
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }