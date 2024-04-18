import { Button, Modal, Table } from "flowbite-react";
import React, { useEffect, useState } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

const DashSales = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [sales, setSales] = useState([]);
  const [showMore, setShowMore] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saleIdToDelete, setSaleIdToDelete] = useState('');
  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await fetch(`/api/sale/getsales`);
        const data = await res.json();
        if (res.ok) {
          setSales(data.sales);
          if (data.sales.length < 9) {
            setShowMore(false);
          }
        }
      } catch (error) {
        console.log(error.message);
      }
    };
    if (currentUser.isAdmin) {
      fetchSales();
    }
  }, [currentUser._id]);
  const handleShowMore = async () => {
    const startIndex = sales.length;
    try {
      const res = await fetch(`/api/post/getsales?startIndex=${startIndex}`);
      const data = await res.json();
      if (res.ok) {
        setSales((prev) => [...prev, ...data.sales]);
        if (data.sales.length < 9) {
          setShowMore(false);
        }
      }
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleDeleteSale = async () => {
    setShowModal(false);
    try {
      const res = await fetch(
        `/api/sale/deletesale/${saleIdToDelete}`,
        {
          method: 'DELETE',
        }
      );
      const data = await res.json();
      if (!res.ok) {
        console.log(data.message);
      } else {
        setSales((prev) =>
          prev.filter((sale) => sale._id !== saleIdToDelete)
        );
      }
    } catch (error) {
      console.log(error.message);
    }
  };
  return (
    <div className="table-auto overflow-x-scroll md:mx-auto p-3 scrollbar scrollbar-track-slate-100 scrollbar-thumb-slate-300 dark:scrollbar-track-slate-700 dark:scrollbar-thumb-slate-500">
      {currentUser.isAdmin && sales.length > 0 ? (
        <>
          <Table hoverable className="shadow-md">
            <Table.Head>
              <Table.HeadCell>Date updated</Table.HeadCell>
              <Table.HeadCell>Product name</Table.HeadCell>
              <Table.HeadCell>Price Per Unit</Table.HeadCell>
              <Table.HeadCell>Quantity</Table.HeadCell>
              <Table.HeadCell>Total Price</Table.HeadCell>
              {
                currentUser.isAdmin && (
                  <Table.HeadCell>Delete</Table.HeadCell>
                )
              }
            </Table.Head>
            {sales.map((sale) => (
              <Table.Body key={sale._id} className="divide-y">
                <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell>
                    {new Date(sale.updatedAt).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell>
                    <Link className="font-medium text-gray-900 dark:text-white">
                      {sale.productName}
                    </Link>
                  </Table.Cell>
                  <Table.Cell>{sale.pricePerUnit.toLocaleString()}</Table.Cell>
                  <Table.Cell>{sale.quantity}</Table.Cell>
                  <Table.Cell>{sale.totalPrice.toLocaleString()}</Table.Cell>
                  {
                    currentUser.isAdmin && (
                      <Table.Cell>
                      <span
                        onClick={() => {
                          setShowModal(true);
                          setSaleIdToDelete(sale._id);
                        }}
                        className="font-medium text-red-500 hover:underline cursor-pointer"
                      >
                        Delete
                      </span>
                    </Table.Cell>
                    )
                  }
                 
                </Table.Row>
              </Table.Body>
            ))}
          </Table>
          {showMore && (
            <button
              onClick={handleShowMore}
              className="w-full text-teal-500 self-center text-sm py-7"
            >
              Show more
            </button>
          )}
        </>
      ) : (
        <p>You have no sales yet!</p>
      )}

      <Modal
    show={showModal}
    onClose={() => setShowModal(false)}
    popup
    size='md'
  >
    <Modal.Header />
    <Modal.Body>
      <div className='text-center'>
        <HiOutlineExclamationCircle className='h-14 w-14 text-gray-400 dark:text-gray-200 mb-4 mx-auto' />
        <h3 className='mb-5 text-lg text-gray-500 dark:text-gray-400'>
          Are you sure you want to delete this sale?
        </h3>
        <div className='flex justify-center gap-4'>
          <Button onClick={()=>handleDeleteSale()} color='failure' >
            Yes, I'm sure
          </Button>
          <Button color='gray' onClick={() => setShowModal(false)}>
            No, cancel
          </Button>
        </div>
      </div>
    </Modal.Body>
  </Modal>
    </div>
  );
};

export default DashSales;
