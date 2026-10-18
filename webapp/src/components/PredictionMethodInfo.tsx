export const predictionDescription = "Participation estimate based on observable browser activity.";

export function PredictionMethodLink() {
  return <a href="#prediction-method">How predictions work</a>;
}

export function PredictionMethodInfo() {
  return <details id="prediction-method" className="prediction-method">
    <summary>How predictions work</summary>
    <div>
      <p>AttendSense uses tab visibility, window focus, idle time, and recent interaction to estimate an observable participation category.</p>
      <p>It does not measure thoughts, comprehension, learning, or guaranteed attendance. Prototype model validation used controlled synthetic sessions; real-world evaluation is future work.</p>
    </div>
  </details>;
}
