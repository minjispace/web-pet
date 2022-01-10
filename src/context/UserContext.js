import React, { useContext, useEffect, useReducer, useState } from "react";

import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, provider } from "../firebase";

import UserReducer, { UserinitialState } from "../reducer/UserReducer";

import {
  BUY_ITEM,
  LOAD_USER_CLOTHES,
  LOAD_USER_DATA,
  LOGIN_AUTH,
  LOGOUT_AUTH,
  OFF_LOADING,
  SET_ERROR,
  SET_LOADING,
  STAT_CONTROL,
} from "../utils/action";

const UserContext = React.createContext();

const UserProvider = ({ children }) => {
  const [tempUserDoc, setUserDoc] = useState("");
  const [state, dispatch] = useReducer(UserReducer, UserinitialState);

  // LOGIN PART --------------------------------
  const loginAuth = async () => {
    try {
      const { user } = await signInWithPopup(auth, provider);
      const checkedUser = await checkUser(user.uid);

      // OLD USER-----------------------
      if (user.uid === checkedUser) {
        return getSavedData(user.uid);
      }

      // NEW USER-----------------------
      if (user) {
        loginUser(user);
        setUserDoc(user.uid);
        return dispatch({ type: LOGIN_AUTH, payload: user });
      }
    } catch (error) {
      dispatch({ type: SET_ERROR, payload: error.message });
    }
  };

  const getSavedData = async (userId) => {
    const newRef = doc(db, "users", userId);
    const user = await getDoc(newRef);
    if (user.id === userId) {
      setUserDoc(userId);
      return dispatch({
        type: LOAD_USER_DATA,
        payload: user.data(),
      });
    }
  };

  const checkUser = async (id) => {
    const singleRef = doc(db, "users", id);
    const user = await getDoc(singleRef);
    if (user.data()) {
      return user.id;
    } else {
      return null;
    }
  };

  const loginUser = async (user) => {
    const { displayName, uid, photoURL } = user;

    const userInitData = {
      userInfo: {
        name: displayName,
        photo: photoURL,
        money: 100,
        level: 1,
        happy: 0,
        health: 0,
      },
      userClothes: {
        hair: "",
        cap: "",
        bag: "",
        acc: "",
        glass: "",
        ribon: "",
        tshirts: "",
      },
      boughtItem: {
        hair: [],
        cap: [],
        bag: [],
        acc: [],
        glass: [],
        ribon: [],
        tshirts: [],
      },
    };

    const newRef = doc(db, "users", uid);
    await setDoc(newRef, userInitData);
    dispatch({ type: LOAD_USER_DATA, payload: userInitData });
  };

  // login refresh -------------------------
  const stayLogin = () => {
    auth.onAuthStateChanged((user) => {
      if (user === null || user.displayName === "") {
        dispatch({ type: OFF_LOADING });
      }
      if (user) {
        getSavedData(user.uid);
        dispatch({ type: LOGIN_AUTH, payload: user });
      }
    });
  };

  // Logout part -----------------------------

  const logoutAuth = async () => {
    dispatch({ type: SET_LOADING });
    try {
      await auth.signOut();
      dispatch({ type: LOGOUT_AUTH });
    } catch (error) {
      dispatch({ type: SET_ERROR, payload: error.message });
    }
  };

  // Update User Data ------------------

  const updateUserData = async (newItems, restPrice) => {
    if (!tempUserDoc) return;
    const newUsersDoc = doc(db, "users", tempUserDoc);
    await updateDoc(newUsersDoc, {
      boughtItem: newItems,
      userInfo: {
        ...state.loadUser.userInfo,
        money: restPrice,
      },
    });
  };

  // handle Other ------------------------------------
  const handleBtn = (id, price, newName) => {
    const productPrice = Number(price * 10);
    const userMoney = state.loadUser && Number(state.loadUser.userInfo.money);

    if (productPrice <= userMoney) {
      const popup = window.confirm("아이템을 구매하시겠습니까?");
      if (popup) {
        const newItems = { ...state.loadUser.boughtItem };
        newItems[newName].push(id);
        const restPrice = userMoney - productPrice;
        dispatch({ type: BUY_ITEM, payload: { newItems, restPrice } });
        updateUserData(newItems, restPrice);
      }
    } else {
      window.confirm("돈이 부족합니다. 밥을 먹이러 가시겠습니까?");
    }
  };

  const updateStat = async (numberPoint, type) => {
    const newUsersDoc = doc(db, "users", tempUserDoc);
    const { happy, health, level, money } = state.loadUser.userInfo;

    let statObj = { happy, health };
    let { happy: happyStat, health: healthStat } = statObj;

    if (type === "happy") {
      happyStat += numberPoint;
    } else if (type === "health") {
      healthStat += numberPoint;
    }

    const levelUp = happyStat >= 100 && healthStat >= 100;

    if (levelUp) {
      return await updateDoc(newUsersDoc, {
        userInfo: {
          ...state.loadUser.userInfo,
          level: level + 1,
          happy: 0,
          health: 0,
          money: money + 30,
        },
      });
    }
    await updateDoc(newUsersDoc, {
      userInfo: {
        ...state.loadUser.userInfo,
        [type]:
          state.loadUser.userInfo[type] + numberPoint < 100
            ? state.loadUser.userInfo[type] + numberPoint
            : 100,
      },
    });
  };

  const handleStat = async (type, point) => {
    const {
      userInfo: { happy, health },
    } = state.loadUser;

    const numberPoint = parseInt(point);
    if (type === "health") {
      if (health >= 100) {
        return null;
      } else {
        updateStat(numberPoint, type);
      }
    } else if (type === "happy") {
      if (happy >= 100) {
        return null;
      } else {
        updateStat(numberPoint, type);
      }
    }
  };

  // Load User clothes data;
  const userDataSnapshot = () => {
    const singleRef = doc(db, "users", tempUserDoc);
    onSnapshot(singleRef, (snapshot) => {
      return dispatch({ type: LOAD_USER_CLOTHES, payload: snapshot.data() });
    });
  };

  // Use Effect --------------------------------------------

  useEffect(() => {
    stayLogin();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (tempUserDoc) {
      userDataSnapshot();
    }
    // eslint-disable-next-line
  }, [tempUserDoc]);

  return (
    <UserContext.Provider
      value={{
        ...state,
        handleStat,
        tempUserDoc,
        loginAuth,
        logoutAuth,
        handleBtn,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  return useContext(UserContext);
};
export default UserProvider;
