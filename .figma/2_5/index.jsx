import React from 'react';

import styles from './index.module.scss';

const Component = () => {
  return (
    <div className={styles.homeScreen}>
      <div className={styles.autoWrapper}>
        <p className={styles.a1039Am}>10:39 am</p>
        <img src="../image/mi34qzt9-x6en1nq.svg" className={styles.signal} />
        <img src="../image/mi34qzt9-b2uoyfm.svg" className={styles.wifi} />
        <img src="../image/mi34qzt9-464dfpj.svg" className={styles.wifi} />
      </div>
      <div className={styles.autoWrapper4}>
        <div className={styles.basemapImage}>
          <div className={styles.autoWrapper2}>
            <div className={styles.ellipse4}>
              <img src="../image/mi34qzta-pr6dqlm.svg" className={styles.userAlt} />
            </div>
            <div className={styles.ellipse1}>
              <img
                src="../image/mi34qzt9-v5i66a3.svg"
                className={styles.crosshairs}
              />
            </div>
          </div>
          <div className={styles.autoWrapper3}>
            <div className={styles.ellipse3}>
              <img src="../image/mi34qzta-hpzz8sd.svg" className={styles.vector} />
            </div>
            <div className={styles.ellipse2}>
              <img src="../image/mi34qzt9-etd5lxm.svg" className={styles.filter} />
            </div>
          </div>
        </div>
        <div className={styles.rectangle7}>
          <div className={styles.rectangle1}>
            <img src="../image/mi34qzt9-7cr71gy.svg" className={styles.vector} />
            <p className={styles.whereTo}>Where to?</p>
            <img src="../image/mi34qzt9-0tecdqe.svg" className={styles.vector2} />
          </div>
        </div>
        <div className={styles.line1} />
        <div className={styles.line2} />
        <div className={styles.line3} />
      </div>
    </div>
  );
}

export default Component;
