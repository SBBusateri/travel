import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CarRangeModel {
  constructor() {
    this.weightImpact = Math.random() * 0.01;
    this.bias = 0;
    this.learningRate = 0.0001;
  }

  predict(weight) {
    return this.weightImpact * weight + this.bias;
  }

  train(data, epochs = 100) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      data.forEach(({ weight, actualMpgReduction }) => {
        const predicted = this.predict(weight);
        const error = actualMpgReduction - predicted;

        this.weightImpact += this.learningRate * error * weight;
        this.bias += this.learningRate * error;
        totalError += error * error;
      });
      if (epoch % 10 === 0) console.log(`Epoch ${epoch}, MSE: ${totalError / data.length}`);
    }
  }

  getRange(baseMpg, gasTankSize, weight) {
    const mpgReduction = this.predict(weight);
    const adjustedMpg = Math.max(baseMpg - mpgReduction, 1);
    return Math.round(adjustedMpg * gasTankSize);
  }
}

export default CarRangeModel;
