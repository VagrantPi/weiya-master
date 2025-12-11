import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <section className="card card-center">
        <h1 className="page-title">404 - 找不到頁面</h1>
        <p className="page-subtitle">
          連結可能已失效，或活動網址輸入錯誤。
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate('/')}
        >
          回到首頁
        </button>
      </section>
    </div>
  );
}

