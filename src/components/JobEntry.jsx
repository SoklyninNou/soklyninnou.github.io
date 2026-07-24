export default function JobEntry({ title, titleClassName, periods, className }) {
  return (
    <div className={className}>
      <div className={titleClassName}>{title}</div>
      {periods.map((period) => (
        <div key={period.dateRange}>
          <p style={{ textDecoration: 'underline', lineHeight: '100%' }}>{period.dateRange}</p>
          <ul>
            {period.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
