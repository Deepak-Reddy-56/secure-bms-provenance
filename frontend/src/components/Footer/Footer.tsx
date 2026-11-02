import './Footer.css';

export function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-left">
          <span>Hyperledger Fabric</span>
          <span className="footer-divider" aria-hidden="true">·</span>
          <span>Day 1 — Component Registration &amp; Verification</span>
        </div>
        <div className="footer-right">
          Component Provenance System
        </div>
      </div>
    </footer>
  );
}
