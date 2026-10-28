import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import'./style.css';

const savedUrl=localStorage.getItem('sbs_project_url')||'';
const savedKey=localStorage.getItem('sbs_public_key')||'';
const URL0=import.meta.env.VITE_SUPABASE_URL||savedUrl;
const KEY0=import.meta.env.VITE_SUPABASE_ANON_KEY||savedKey;
const client=URL0&&KEY0?createClient(URL0,KEY0):null;

const money=n=>new Intl.NumberFormat('en-IN',{
  style:'currency',
  currency:'INR',
  maximumFractionDigits:2
}).format(Number(n)||0);

const today=()=>new Date().toISOString().slice(0,10);

const blankCustomer={
  full_name:'',
  business_name:'',
  mobile:'',
  email:'',
  address:'',
  notes:''
};

const blankBank={
  bank_name:'',
  account_name:'',
  account_number:'',
  ifsc:'',
  branch:'',
  upi_id:'',
  notes:''
};

const blankInvoice={
  customer_id:'',
  invoice_number:'',
  invoice_date:today(),
  due_date:'',
  description:'',
  amount:'',
  gst_rate:'5',
  status:'Unpaid'
};

const blankPayment={
  invoice_id:'',
  payment_date:today(),
  amount:'',
  method:'Bank transfer',
  reference:'',
  notes:''
};

function App(){
  const [session,setSession]=useState(null),
        [checking,setChecking]=useState(true),
        [config,setConfig]=useState(!client),
        [url,setUrl]=useState(URL0),
        [key,setKey]=useState(KEY0),
        [email,setEmail]=useState(''),
        [password,setPassword]=useState(''),
        [busy,setBusy]=useState(false),
        [msg,setMsg]=useState(''),
        [role,setRole]=useState(''),
        [customers,setCustomers]=useState([]),
        [search,setSearch]=useState(''),
        [formOpen,setFormOpen]=useState(false),
        [editing,setEditing]=useState(null),
        [form,setForm]=useState(blankCustomer);

  // File continues...
}
createRoot(document.getElementById('root')).render(<App/>);
