// fetch items for console demo
async function fetchItems(){
  const res = await fetch('/api/items/');
  if(!res.ok){ console.error('items fetch failed', res.status); return; }
  const data = await res.json();
  console.log('items', data);
}
document.addEventListener('DOMContentLoaded', ()=> { fetchItems(); });

// CSRF helper for any AJAX POST
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
const csrftoken = getCookie('csrftoken');

// Example: post an order (use browser devtools console to run)
async function postExampleOrder(){
  const payload = {
    customer_name: "Walk-in",
    total: "120.00",
    items: [{item_id:1, qty:2}]
  };
  const res = await fetch('/api/orders/', {
    method: 'POST',
    headers: {'Content-Type':'application/json','X-CSRFToken':csrftoken},
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('order create', res.status, data);
}
window.postExampleOrder = postExampleOrder;
